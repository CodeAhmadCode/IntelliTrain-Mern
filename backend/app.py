from flask import Flask, request, Response
from flask_restful import Api, Resource
from flask_cors import CORS
import tensorflow as tf
from tensorflow.keras.models import load_model
from pymongo import MongoClient
import base64
import io
import threading
import time
import numpy as np
from PIL import Image
from flask import jsonify
# Flask app setup
app = Flask(__name__)
api = Api(app)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['imageProjectDB']
images_collection = db['images']

# Constants
image_size = (224, 224)
batch_size = 16
epochs = 5
learning_rate = 0.001
# Dynamic classes fetcher
def get_classes():
    return list(images_collection.distinct("class"))

# Custom Data Loader
class MongoImageSequence(tf.keras.utils.Sequence):
    def __init__(self, class_names, batch_size=32, subset='training', validation_split=0.2, **kwargs):
        super().__init__(**kwargs)  # Ensure the parent class is initialized properly
        self.batch_size = batch_size
        self.class_names = class_names
        self.subset = subset
        self.validation_split = validation_split
        self.subset = subset

        self.images = list(images_collection.find({}))
        if not self.images:
            raise ValueError("No images found in MongoDB collection")

        np.random.shuffle(self.images)

        split_idx = int(len(self.images) * (1 - validation_split))
        if subset == 'training':
            self.images = self.images[:split_idx]
        else:
            self.images = self.images[split_idx:]

    def __len__(self):
        return int(np.ceil(len(self.images) / self.batch_size))

    def __getitem__(self, idx):
        batch_images = self.images[idx * self.batch_size:(idx + 1) * self.batch_size]
        X = np.zeros((len(batch_images), *image_size, 3))
        y = np.zeros((len(batch_images), len(self.class_names)))

        for i, img_doc in enumerate(batch_images):
            try:
                img_data = base64.b64decode(img_doc['base64'])
                img = Image.open(io.BytesIO(img_data))
                img = img.convert('RGB')
                img = img.resize(image_size)
                img_array = np.array(img) / 255.0
                X[i] = img_array

                class_name = img_doc.get('class')
                class_idx = self.class_names.index(class_name)
                y[i, class_idx] = 1
            except Exception as e:
                print(f"Error processing image {img_doc.get('_id')}: {str(e)}")
        return X, y

# Global variable to track training status
training_status = {'status': 'idle', 'error': None}

# Training Endpoint
class TrainModel(Resource):
    def post(self):
        def train_model_thread():
            global training_status
            training_status['status'] = 'in_progress'
            training_status['error'] = None
            try:
                current_classes = get_classes()
                train_sequence = MongoImageSequence(current_classes, batch_size=batch_size, subset='training')
                val_sequence = MongoImageSequence(current_classes, batch_size=batch_size, subset='validation')

                base_model = tf.keras.applications.MobileNetV2(weights="imagenet", include_top=False, input_shape=(*image_size, 3))
                for layer in base_model.layers[-30:]:
                    layer.trainable = True

                x = base_model.output
                x = tf.keras.layers.GlobalAveragePooling2D()(x)
                x = tf.keras.layers.Dense(64, activation="relu")(x)
                x = tf.keras.layers.Dropout(0.5)(x)
                x = tf.keras.layers.Dense(32, activation="relu")(x)
                x = tf.keras.layers.Dropout(0.3)(x)
                predictions = tf.keras.layers.Dense(len(current_classes), activation="softmax")(x)

                model = tf.keras.Model(inputs=base_model.input, outputs=predictions)
                model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
                              loss="categorical_crossentropy", metrics=["accuracy"])

                model.fit(train_sequence, validation_data=val_sequence, epochs=epochs, verbose=1)
                model.save("updated_model_mongo.keras")
                training_status['status'] = 'completed'
            except Exception as e:
                training_status['status'] = 'failed'
                training_status['error'] = str(e)

        thread = threading.Thread(target=train_model_thread)
        thread.start()
        return Response(status=202)

# Training Status Endpoint
@app.route('/api/training-status', methods=['GET'])
def training_status_endpoint():
    return training_status


# Prediction Endpoint


@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    image_file = request.files['image']
    if image_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        img_data = image_file.read()
        img = Image.open(io.BytesIO(img_data))
        img = img.convert('RGB')
        img = img.resize(image_size)
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        model = load_model("updated_model_mongo.keras")
        current_classes = get_classes()
        predictions = model.predict(img_array)
        predicted_class = current_classes[np.argmax(predictions)]
        confidence = np.max(predictions)

        return jsonify({'predicted_class': predicted_class, 'confidence': float(confidence)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Image Upload Endpoint
class ImageUpload(Resource):
    def post(self):
        try:
            if 'image' not in request.files:
                raise ValueError('No file part')

            image_file = request.files['image']
            class_name = request.form.get('class')

            current_classes = get_classes()
            app.logger.debug(f'Available classes: {current_classes}')

            if not current_classes:
                # If no classes exist, add the new class
                images_collection.insert_one({'class': class_name})
                current_classes = get_classes()
                app.logger.debug(f'Added new class: {class_name}. Available classes: {current_classes}')

            if class_name not in current_classes:
                # If the class does not exist, add it
                images_collection.insert_one({'class': class_name})
                current_classes = get_classes()
                app.logger.debug(f'Added new class: {class_name}. Available classes: {current_classes}')

            img_data = image_file.read()
            base64_image = base64.b64encode(img_data).decode('utf-8')
            timestamp = int(time.time())
            image_doc = {
                'filename': f"{class_name}_{timestamp}.jpg",
                'class': class_name,
                'base64': base64_image,
                'timestamp': timestamp
            }
            images_collection.insert_one(image_doc)
            return Response('Image uploaded successfully', status=200)
        except ValueError as ve:
            app.logger.error(f'ValueError: {str(ve)}')
            return Response(str({'error': str(ve)}), status=400)
        except pymongo.errors.PyMongoError as pm_err:
            app.logger.error(f'PyMongoError: {str(pm_err)}')
            return Response(str({'error': 'Database error', 'details': str(pm_err)}), status=500)
        except Exception as e:
            app.logger.error(f'Unexpected error: {str(e)}')
            return Response(str({'error': 'An unexpected error occurred', 'details': str(e)}), status=500)
api.add_resource(TrainModel, '/api/train')
api.add_resource(ImageUpload, '/api/upload')

if __name__ == '__main__':
    app.run(debug=True)
