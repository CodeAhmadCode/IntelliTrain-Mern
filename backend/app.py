from flask import Flask, request, Response, jsonify
from flask_restful import Api, Resource
from flask_cors import CORS
import tensorflow as tf
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense, Dropout, Input
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator 
from pymongo import MongoClient
import base64
import io
import threading
import time
import numpy as np
from PIL import Image
import random

# Flask app setup
app = Flask(__name__)
api = Api(app)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['imageProjectDB']
images_collection = db['images']

# Constants
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 10
learning_rate = 0.001

# Global variable to track training status
training_status = {'status': 'idle', 'error': None}

# Dynamic classes fetcher
def get_classes():
    return list(images_collection.distinct("class"))

# Custom Data Generator with Augmentation
class MongoImageGenerator(tf.keras.utils.Sequence):
    def __init__(self, class_names, batch_size=32, subset='training', validation_split=0.2):
        self.batch_size = batch_size
        self.class_names = class_names
        self.subset = subset
        self.validation_split = validation_split
        self.datagen = ImageDataGenerator(
            rescale=1.0/255,
            rotation_range=20,
            horizontal_flip=True,
            zoom_range=0.2
        )
        
        self.images = list(images_collection.find({}))
        if not self.images:
            raise ValueError("No images found in MongoDB collection")

        random.shuffle(self.images)
        
        split_idx = int(len(self.images) * (1 - validation_split))
        if subset == 'training':
            self.images = self.images[:split_idx]
        else:
            self.images = self.images[split_idx:]

    def __len__(self):
        return int(np.ceil(len(self.images) / self.batch_size))

    def __getitem__(self, idx):
        batch_images = self.images[idx * self.batch_size:(idx + 1) * self.batch_size]
        X = np.zeros((len(batch_images), IMG_SIZE, IMG_SIZE, 3))
        y = np.zeros((len(batch_images), len(self.class_names)))

        for i, img_doc in enumerate(batch_images):
            try:
                img_data = base64.b64decode(img_doc['base64'])
                img = Image.open(io.BytesIO(img_data))
                img = img.convert('RGB')
                img = img.resize((IMG_SIZE, IMG_SIZE))
                img_array = np.array(img)
                
                # Apply augmentation
                transformed = self.datagen.random_transform(img_array)
                X[i] = transformed
                
                class_name = img_doc.get('class')
                class_idx = self.class_names.index(class_name)
                y[i, class_idx] = 1
            except Exception as e:
                print(f"Error processing image {img_doc.get('_id')}: {str(e)}")
        return X, y

# Training Endpoint
class TrainModel(Resource):
    def post(self):
        def train_model_thread():
            global training_status
            training_status['status'] = 'in_progress'
            training_status['error'] = None
            
            try:
                current_classes = get_classes()
                if len(current_classes) < 2:
                    raise ValueError("Need at least 2 classes for training")
                
                train_generator = MongoImageGenerator(current_classes, batch_size=BATCH_SIZE, subset='training')
                val_generator = MongoImageGenerator(current_classes, batch_size=BATCH_SIZE, subset='validation')
                
                # Load pre-trained MobileNetV2
                base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(IMG_SIZE, IMG_SIZE, 3))
                base_model.trainable = False
                
                # Create new model
                inputs = Input(shape=(IMG_SIZE, IMG_SIZE, 3))
                x = base_model(inputs, training=False)
                x = GlobalAveragePooling2D()(x)
                x = Dropout(0.2)(x)
                outputs = Dense(len(current_classes), activation='softmax')(x)
                
                model = Model(inputs, outputs)
                model.compile(optimizer=Adam(learning_rate=learning_rate),
                              loss='categorical_crossentropy',
                              metrics=['accuracy'])
                
                # Train the model
                model.fit(
                    train_generator,
                    validation_data=val_generator,
                    epochs=EPOCHS
                )
                
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
        img = img.resize((IMG_SIZE, IMG_SIZE))
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        model = load_model("updated_model_mongo.keras")
        current_classes = get_classes()
        predictions = model.predict(img_array)
        predicted_class = current_classes[np.argmax(predictions)]
        confidence = np.max(predictions)

        return jsonify({
            'predicted_class': predicted_class,
            'confidence': float(confidence),
            'all_predictions': {cls: float(pred) for cls, pred in zip(current_classes, predictions[0])}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Image Upload Endpoint (unchanged from your original)
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
                images_collection.insert_one({'class': class_name})
                current_classes = get_classes()
                app.logger.debug(f'Added new class: {class_name}. Available classes: {current_classes}')

            if class_name not in current_classes:
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
        except Exception as e:
            app.logger.error(f'Unexpected error: {str(e)}')
            return Response(str({'error': 'An unexpected error occurred', 'details': str(e)}), status=500)

api.add_resource(TrainModel, '/api/train')
api.add_resource(ImageUpload, '/api/upload')

if __name__ == '__main__':
    app.run(debug=True)