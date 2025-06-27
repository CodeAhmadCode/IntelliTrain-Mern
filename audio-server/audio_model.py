import os
import io
import tempfile
import traceback
import subprocess
import datetime
from werkzeug.utils import secure_filename
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
import librosa
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Input, BatchNormalization
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
import joblib

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pymongo import MongoClient
import gridfs
from bson import ObjectId

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "https://intellitrain-mern-1.onrender.com"
        ],
        "methods": ["GET", "POST", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})
# Configure TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
tf.get_logger().setLevel('ERROR')

# Database Setup
client = MongoClient('mongodb://localhost:27017/')
db = client['audio_classification_db']
print(f"Connected to MongoDB database: {db.name}")  # Add verification
fs = gridfs.GridFS(db)
audio_collection = db['audio_samples']
model_collection = db['models']
classes_collection = db['audio_classes']

# Initialize YAMNet
yamnet = hub.load("https://tfhub.dev/google/yamnet/1")

# Database Initialization
def initialize_database():
    """Initialize database collections and indexes"""
    if 'audio_classes' not in db.list_collection_names():
        db.create_collection('audio_classes')
    
    existing_indexes = db.audio_classes.index_information()
    if 'name_1' not in existing_indexes:
        try:
            db.audio_classes.create_index('name', unique=True)
        except Exception as e:
            if 'duplicate key' in str(e).lower():
                pipeline = [
                    {"$group": {
                        "_id": "$name",
                        "dups": {"$push": "$_id"},
                        "count": {"$sum": 1}
                    }},
                    {"$match": {"count": {"$gt": 1}}}
                ]
                for doc in db.audio_classes.aggregate(pipeline):
                    db.audio_classes.delete_many({
                        "_id": {"$in": doc["dups"][1:]},
                        "name": doc["_id"]
                    })
                db.audio_classes.create_index('name', unique=True)

    classes_collection.create_index('name', unique=True)
    audio_collection.create_index('class')

# Audio Processing Functions
# audio_model.py - Updated validate_audio function
def validate_audio(audio_bytes):
    """Validate audio quality and format using in-memory processing"""
    try:
        # Use BytesIO directly
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000, duration=1.5)
        
        if len(y) < sr * 0.5:
            return False, "Audio too short (minimum 0.5 second)"
            
        rms = librosa.feature.rms(y=y)
        if np.mean(rms) < 0.005:
            return False, "Audio too quiet"
            
        return True, ""
    except Exception as e:
        return False, f"Invalid audio: {str(e)}"

def extract_embedding(audio_data, sr=16000):
    """Extract audio features using YAMNet"""
    try:
        y, sr = librosa.load(io.BytesIO(audio_data), sr=sr, duration=1.0)
        if len(y) < sr:
            y = np.pad(y, (0, max(0, sr - len(y))))
        
        waveform = tf.convert_to_tensor(y, dtype=tf.float32)
        _, embeddings, _ = yamnet(waveform)
        return np.mean(embeddings, axis=0)
    except Exception as e:
        print(f"Error processing audio: {e}")
        return np.zeros(1024)

# API Endpoints
@app.route('/api/audio/classes/initialize-defaults', methods=['POST'])
def initialize_default_classes():
    """Initialize default classes if they don't exist"""
    try:
        default_classes = ['Class 1', 'Class 2']
        initialized_classes = []
        
        for class_name in default_classes:
            if not classes_collection.find_one({'name': class_name}):
                result = classes_collection.insert_one({
                    'name': class_name,
                    'created_at': datetime.datetime.now(),
                    'is_default': True
                })
                initialized_classes.append({
                    '_id': str(result.inserted_id),
                    'name': class_name
                })
        
        return jsonify({
            'status': 'success',
            'initialized_classes': initialized_classes
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/classes', methods=['GET', 'POST'])
def handle_classes():
    """Handle class creation and listing"""
    if request.method == 'GET':
        try:
            classes = list(classes_collection.find({}, {'_id': 1, 'name': 1}))
            return jsonify([{
                '_id': str(cls['_id']),
                'name': cls['name']
            } for cls in classes]), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            class_name = request.json.get('name')
            if not class_name:
                return jsonify({'error': 'Class name required'}), 400
            
            if classes_collection.find_one({'name': class_name}):
                return jsonify({'error': 'Class already exists'}), 400
            
            result = classes_collection.insert_one({
                'name': class_name,
                'created_at': datetime.datetime.now()
            })
            
            return jsonify({
                '_id': str(result.inserted_id),
                'name': class_name
            }), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/audio/samples', methods=['POST'])
def handle_samples():
    """Handle audio sample uploads - automatically creates classes if needed"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
            
        audio_file = request.files['audio']
        class_label = request.form.get('class')
        
        if not class_label:
            return jsonify({'error': 'No class specified'}), 400
            
        # Process audio first (before DB operations)
        audio_bytes = audio_file.read()
        is_valid, validation_msg = validate_audio(audio_bytes)
        if not is_valid:
            return jsonify({'error': validation_msg}), 400
            
        # Create class if it doesn't exist (upsert operation)
        classes_collection.update_one(
            {'name': class_label},
            {'$setOnInsert': {
                'name': class_label,
                'created_at': datetime.datetime.now()
            }},
            upsert=True
        )
        
        # Store audio and metadata
        file_id = fs.put(audio_bytes, filename=secure_filename(audio_file.filename))
        embedding = extract_embedding(audio_bytes)
        
        if np.all(embedding == 0):
            fs.delete(file_id)
            return jsonify({'error': 'Failed to process audio features'}), 400
            
        audio_doc = {
            'file_id': file_id,
            'class': class_label,
            'timestamp': datetime.datetime.now(),
            'filename': secure_filename(audio_file.filename),
            'embedding': embedding.tolist()
        }
        result = audio_collection.insert_one(audio_doc)
        
        return jsonify({
            '_id': str(result.inserted_id),
            'class': class_label,
            'timestamp': audio_doc['timestamp']
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/samples/<sample_id>', methods=['DELETE'])
def delete_sample(sample_id):
    """Delete a specific audio sample"""
    try:
        obj_id = ObjectId(sample_id)
    except:
        return jsonify({'error': 'Invalid sample ID'}), 400
    
    try:
        sample = audio_collection.find_one({'_id': obj_id})
        if not sample:
            return jsonify({'error': 'Sample not found'}), 404
        
        fs.delete(sample['file_id'])
        audio_collection.delete_one({'_id': obj_id})
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/samples/<sample_id>/play', methods=['GET'])
def play_sample(sample_id):
    """Play back a specific audio sample"""
    try:
        obj_id = ObjectId(sample_id)
        sample = audio_collection.find_one({'_id': obj_id})
        if not sample:
            return jsonify({'error': 'Sample not found'}), 404
        
        audio_file = fs.get(sample['file_id'])
        return send_file(
            io.BytesIO(audio_file.read()),
            mimetype='audio/wav',
            as_attachment=False
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/train', methods=['POST'])
def train_model():
    """Train the audio classification model"""
    try:
        # Verify minimum requirements
        class_count = classes_collection.count_documents({})
        if class_count < 2:
            return jsonify({'error': 'Need at least 2 classes to train'}), 400

        # Prepare training data
        X, y = [], []
        for audio_doc in audio_collection.find():
            try:
                X.append(np.array(audio_doc['embedding'], dtype=np.float32))
                y.append(audio_doc['class'])
            except Exception as e:
                print(f"Error loading audio {audio_doc['_id']}: {e}")

        if len(X) < 5:
            return jsonify({'error': 'Need at least 5 samples to train'}), 400

        X = np.array(X)
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)

        # Adjust test size based on sample count
        test_size = min(0.2, 1 - (len(le.classes_) / len(X)))
        if test_size <= 0:
            test_size = 0.1

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, 
            test_size=test_size, 
            random_state=42, 
            stratify=y_encoded
        )

        # Build and train model
        model = Sequential([
            Input(shape=(X.shape[1],)),
            Dense(512, activation='relu', kernel_regularizer='l2'),
            Dropout(0.5),
            BatchNormalization(),
            Dense(256, activation='relu', kernel_regularizer='l2'),
            Dropout(0.5),
            BatchNormalization(),
            Dense(len(le.classes_), activation='softmax')
        ])

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )

        # Train with class weights
        class_weights = compute_class_weight('balanced', classes=np.unique(y_encoded), y=y_encoded)
        history = model.fit(
            X_train, y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            class_weight=dict(enumerate(class_weights)),
            callbacks=[tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)],
            verbose=2
        )

        # Save model
        with tempfile.NamedTemporaryFile(suffix='.h5', delete=False) as model_file:
            model.save(model_file.name)
            model_bytes = model_file.read()
        
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as le_file:
            joblib.dump(le, le_file.name)
            le_bytes = le_file.read()

        model_collection.insert_one({
            'model': model_bytes,
            'label_encoder': le_bytes,
            'accuracy': float(history.history['val_accuracy'][-1]),
            'timestamp': datetime.datetime.now(),
            'classes': le.classes_.tolist()
        })

        return jsonify({
            'status': 'success',
            'accuracy': history.history['val_accuracy'][-1],
            'classes': le.classes_.tolist()
        })
    except Exception as e:
        print(f"Training error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/predict', methods=['POST'])
def predict():
    """Make predictions on new audio samples"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
            
        audio_file = request.files['audio']
        audio_bytes = audio_file.read()
        
        # Validate using in-memory processing
        is_valid, validation_msg = validate_audio(audio_bytes)
        if not is_valid:
            return jsonify({'error': validation_msg}), 400
            
        model_doc = model_collection.find_one(sort=[('timestamp', -1)])
        if not model_doc:
            return jsonify({'error': 'No trained model available'}), 400
            
        # Load model and label encoder - FIX: Use temporary files
        with tempfile.NamedTemporaryFile(suffix='.h5', delete=False) as model_file:
            model_file.write(model_doc['model'])
            model_file_path = model_file.name
        
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as le_file:
            le_file.write(model_doc['label_encoder'])
            le_file_path = le_file.name
        
        try:
            # Load from temp files
            model = tf.keras.models.load_model(model_file_path)
            le = joblib.load(le_file_path)
            
            # Extract features and predict (all in memory)
            embedding = extract_embedding(audio_bytes)
            if np.all(embedding == 0):
                return jsonify({'error': 'Failed to extract audio features'}), 400
                
            pred = model.predict(np.expand_dims(embedding, axis=0), verbose=0)
            
            # Apply temperature scaling
            temperature = 0.5
            scaled_pred = np.exp(np.log(pred) / temperature)
            scaled_pred = scaled_pred / np.sum(scaled_pred)
            
            # Format and return results
            results = {
                str(cls): float(conf) 
                for cls, conf in zip(le.classes_, scaled_pred[0])
            }
            
            return jsonify(dict(sorted(results.items(), key=lambda x: x[1], reverse=True)))
        finally:
            # Clean up temp files
            os.unlink(model_file_path)
            os.unlink(le_file_path)
            
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Main Execution
if __name__ == '__main__':
    initialize_database()
    app.run(port=5001, debug=True)