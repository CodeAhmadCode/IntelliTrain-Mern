from flask import Flask, request, jsonify
from flask_restful import Api, Resource
from flask_cors import CORS
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator, img_to_array
import numpy as np
import time
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from sklearn.metrics import classification_report
from pymongo import MongoClient
import io
from PIL import Image
import base64
import threading

app = Flask(__name__)
api = Api(app)

# Enable CORS for the API routes
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})


client = MongoClient('mongodb://localhost:27017/')
db = client['imageProjectDB']
images_collection = db['images']

model = None
training_completed = False
# Classes
classes = ['class1', 'class2']

class MongoImageSequence(tf.keras.utils.Sequence):
    def __init__(self, class_names, batch_size=32, subset='training', validation_split=0.2):
        self.batch_size = batch_size
        self.class_names = class_names
        self.validation_split = validation_split
        self.subset = subset
        
        # Get all image documents
        self.images = list(images_collection.find({}))
        if not self.images:
            raise ValueError("No images found in MongoDB collection")
            
        np.random.shuffle(self.images)
        
        # Split into training and validation
        split_idx = int(len(self.images) * (1 - validation_split))
        if subset == 'training':
            self.images = self.images[:split_idx]
        else:
            self.images = self.images[split_idx:]

    def __len__(self):
        return int(np.ceil(len(self.images) / self.batch_size))

    def __getitem__(self, idx):
        batch_images = self.images[idx * self.batch_size:(idx + 1) * self.batch_size]
        
        # Initialize batch arrays
        X = np.zeros((len(batch_images), 224, 224, 3))
        y = np.zeros((len(batch_images), len(self.class_names)))
        
        for i, img_doc in enumerate(batch_images):
            try:
                # First try to get image directly
                if 'image' in img_doc:
                    img_data = img_doc['image']
                # Then try base64 field
                elif 'base64' in img_doc:
                    img_data = base64.b64decode(img_doc['base64'])
                else:
                    print(f"Warning: Document {img_doc['_id']} has no image data")
                    continue

                # Convert image bytes to array
                img = Image.open(io.BytesIO(img_data))
                img = img.convert('RGB')  # Ensure image is in RGB format
                img = img.resize((224, 224))
                img_array = img_to_array(img)
                X[i] = img_array / 255.0
                
                # Get class name
                class_name = img_doc.get('class', img_doc.get('className'))
                if class_name not in self.class_names:
                    print(f"Warning: Unknown class {class_name}")
                    continue
                    
                class_idx = self.class_names.index(class_name)
                y[i, class_idx] = 1
                
            except Exception as e:
                print(f"Error processing image {img_doc.get('_id')}: {str(e)}")
                continue
        
        return X, y

class ImageUpload(Resource):
    def post(self):
        if 'image' not in request.files:
            return jsonify({'message': 'No file part'}), 400
        
        image_file = request.files['image']
        class_name = request.form.get('class')

        if class_name not in classes:
            return jsonify({'message': 'Invalid class specified'}), 400
        
        if image_file.filename == '':
            return jsonify({'message': 'No selected file'}), 400
        
        # Read image file
        image_bytes = image_file.read()
        
        # Convert to base64 for storage
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        # Generate a unique filename
        timestamp = int(time.time())
        original_filename = f"{class_name}_original_{timestamp}.jpg"
        
        # Store in MongoDB
        image_doc = {
            'filename': original_filename,
            'class': class_name,
            'base64': base64_image,
            'timestamp': timestamp,
            'type': 'original'
        }
        images_collection.insert_one(image_doc)

        # Perform augmentation and save augmented images
        self.augment_and_save_images(image_bytes, class_name, timestamp)

        return jsonify({'message': 'Image uploaded and augmented successfully'})

    def augment_and_save_images(self, image_bytes, class_name, timestamp):
        datagen = ImageDataGenerator(
            rescale=1./255,
            rotation_range=40,
            width_shift_range=0.2,
            height_shift_range=0.2,
            shear_range=0.2,
            zoom_range=0.2,
            horizontal_flip=True,
            fill_mode='nearest'
        )

        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)

        i = 0
        for batch in datagen.flow(img_array, batch_size=1):
            augmented_image = Image.fromarray((batch[0] * 255).astype('uint8'))
            buffer = io.BytesIO()
            augmented_image.save(buffer, format='JPEG')
            augmented_bytes = buffer.getvalue()
            
            # Convert to base64 for storage
            base64_augmented = base64.b64encode(augmented_bytes).decode('utf-8')

            augmented_doc = {
                'filename': f"{class_name}_augmented_{timestamp}_{i}.jpg",
                'class': class_name,
                'base64': base64_augmented,
                'timestamp': timestamp,
                'type': 'augmented'
            }
            images_collection.insert_one(augmented_doc)
            
            i += 1
            if i >= 5:
                break

    def train_model(self):
        global model
        
        # Check if there are enough images
        if images_collection.count_documents({}) < 2:
            print("Not enough images in database for training")
            return

        BATCH_SIZE = 32

        try:
            train_sequence = MongoImageSequence(classes, batch_size=BATCH_SIZE, subset='training')
            val_sequence = MongoImageSequence(classes, batch_size=BATCH_SIZE, subset='validation')

            num_classes = len(classes)
            base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))

            x = base_model.output
            x = GlobalAveragePooling2D()(x)
            x = Dense(128, activation='relu')(x)
            predictions = Dense(num_classes, activation='softmax')(x)

            model = Model(inputs=base_model.input, outputs=predictions)

            for layer in base_model.layers:
                layer.trainable = False

            for layer in base_model.layers[-20:]:
                layer.trainable = True

            model.compile(optimizer=tf.keras.optimizers.Adam(1e-5),
                         loss='categorical_crossentropy', metrics=['accuracy'])

            model.fit(train_sequence, epochs=5, validation_data=val_sequence)

            # Evaluate the model
            val_loss, val_acc = model.evaluate(val_sequence)
            print(f'Validation Loss: {val_loss}, Validation Accuracy: {val_acc}')

            all_predictions = []
            all_true_labels = []
            
            for i in range(len(val_sequence)):
                X, y = val_sequence[i]
                pred = model.predict(X)
                all_predictions.extend(pred.argmax(axis=1))
                all_true_labels.extend(y.argmax(axis=1))

            print(classification_report(all_true_labels, all_predictions, target_names=classes))
            
        except Exception as e:
            print(f"Error during training: {str(e)}")
            raise

@app.route('/api/predict', methods=['POST'])
def predict():
    global model

    if 'image' not in request.files:
        return jsonify({'message': 'No file part'}), 400

    image_file = request.files['image']
    
    if image_file.filename == '':
        return jsonify({'message': 'No selected file'}), 400

    try:
        image_bytes = image_file.read()
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0

        predictions = model.predict(img_array)
        predicted_class = classes[np.argmax(predictions)]

        return jsonify({'predicted_class': predicted_class})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

api.add_resource(ImageUpload, '/api/upload')

training_status = {
    'status': 'idle',
    'error': None
}

class TrainModel(Resource):
    def post(self):
        global model, training_status
        if model is not None and training_status['status'] == 'in_progress':
            return jsonify({'message': 'Training already in progress.'}), 400
        
        try:
            training_status['status'] = 'in_progress'
            training_status['error'] = None
            
            # Start training in a separate thread
            thread = threading.Thread(target=self.train_model_thread)
            thread.start()
            
            return jsonify({'message': 'Training started.'})
        except Exception as e:
            training_status['status'] = 'failed'
            training_status['error'] = str(e)
            return jsonify({'error': str(e)}), 500
    
    def train_model_thread(self):
        global training_status
        try:
            ImageUpload().train_model()
            training_status['status'] = 'completed'
        except Exception as e:
            training_status['status'] = 'failed'
            training_status['error'] = str(e)

@app.route('/api/training-status')
def get_training_status():
    try:
        if training_completed: 
            return jsonify({'status': 'completed'})
        else:
            return jsonify({'status': 'in_progress'})
    except Exception as e:
        return jsonify({'status': 'failed', 'error': str(e)})

api.add_resource(TrainModel, '/api/train')

if __name__ == '__main__':
    if images_collection.count_documents({}) > 0:
        try:
            ImageUpload().train_model()
        except Exception as e:
            print(f"Error during initial training: {str(e)}")
    app.run(debug=True)