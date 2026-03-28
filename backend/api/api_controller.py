from fastapi import FastAPI, HTTPException, APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import SessionLocal, Base
from database.model_db import Model, TrainingRun, EvaluationResult, PredictionLog
from fastapi.middleware.cors import CORSMiddleware
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import time
import io
import base64
from PIL import Image
from api.payload import PredictionRequest, PredictionResponse
from model_engine.MLPModel import MLPModel
from model_engine.image_processing import base64_to_tensor, center_digit, base64_to_pil, preprocess_pil_image
import numpy as np
from model_engine.perturbations import apply_perturbation
from database import SessionLocal
import torch
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter(prefix="/api", tags=["Prediction"])

# Initialize/load MLP model once at module import
MLP_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved_models', 'mlp_baseline.pt')
mlp_model = MLPModel()
if os.path.exists(MLP_MODEL_PATH):
    try:
        state = torch.load(MLP_MODEL_PATH, map_location=mlp_model.device)
        mlp_model.model.load_state_dict(state)
    except Exception:
        # ignore load errors but keep model initialized
        pass

@router.post("/predict", response_model=PredictionResponse)
def predict_digit(request: PredictionRequest, db: Session = Depends(get_db)):
    try:
        if request.model_type.lower() != "mlp":
            raise HTTPException(status_code=400, detail="Only 'mlp' model is supported for now.")
        
        print(f"Received prediction request: model={request.model_type}, perturbation={request.perturbation_type}, level={request.perturbation_level}")

        # save raw incoming base64 image (before preprocessing)
        try:
            debug_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'debug_inputs')
            os.makedirs(debug_dir, exist_ok=True)
            raw_b64 = request.image
            if ',' in raw_b64:
                raw_b64 = raw_b64.split(',')[1]
            raw_bytes = base64.b64decode(raw_b64)
            raw_path = os.path.join(debug_dir, f'raw_input_{int(time.time()*1000)}.png')
            with open(raw_path, 'wb') as f:
                f.write(raw_bytes)
        except Exception:
            pass

        try:
            # center the digit in the image before converting to tensor and applying perturbation
            pil = base64_to_pil(request.image)
            arr = np.array(pil)
            centered_arr = center_digit(arr)
            centered_pil = Image.fromarray(centered_arr)

            # convert centered PIL to tensor
            image_tensor = preprocess_pil_image(centered_pil)

            # save preprocessed tensor image (after conversion)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        try:
            t = image_tensor.squeeze().cpu()
            mean = 0.1307
            std = 0.3081
            t = t * std + mean
            t = t.clamp(0.0, 1.0)
            arr = (t.numpy() * 255.0).astype('uint8')
            proc_img = Image.fromarray(arr, mode='L')
            proc_path = os.path.join(debug_dir, f'proc_input_{int(time.time()*1000)}.png')
            proc_img.save(proc_path)
        except Exception:
            pass

        image_tensor = apply_perturbation(
            image=image_tensor,
            perturbation_type=request.perturbation_type,
            perturbation_level=request.perturbation_level
        )

        # perform prediction
        result = mlp_model.predict(image_tensor)
        img = image_tensor.squeeze().cpu().numpy()
        # save a debug image (non-interactive) instead of opening a GUI
        try:
            debug_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'debug_inputs')
            os.makedirs(debug_dir, exist_ok=True)
            save_path = os.path.join(debug_dir, f'input_{int(time.time()*1000)}.png')
            plt.imsave(save_path, img, cmap='gray')
        except Exception:
            pass

        predicted_label = int(result["predicted_label"])
        confidence = float(result["confidence"])

        # determine model_id: try to use an existing MLP model record, otherwise create one
        model_record = db.query(Model).filter(Model.model_type.ilike("mlp")).first()
        if model_record is None:
            # create model record using MLPModel helper
            try:
                created_id = mlp_model.create_model_record()
                model_id = created_id
            except Exception:
                model_id = None
        else:
            model_id = model_record.id

        # save prediction log if we have a model_id
        try:
            if model_id is not None:
                log = PredictionLog(
                    model_id=model_id,
                    predicted_label=predicted_label,
                    confidence=confidence,
                    input_source="api"
                )
                db.add(log)
                db.commit()
                db.refresh(log)
        except Exception:
            db.rollback()

        return PredictionResponse(
            predicted_label=predicted_label,
            confidence=confidence,
            perturbation_type=request.perturbation_type,
            perturbation_level=request.perturbation_level,
            model_type=request.model_type
        )

    except HTTPException as http_error:
        raise http_error
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/models")
def get_models(db: Session = Depends(get_db)):
    models = db.query(Model).all()

    return [
        {
            "id": m.id,
            "name": m.name,
            "model_type": m.model_type,
            "description": m.description,
            "created_at": m.created_at
        }
        for m in models
    ]



@router.get("/training-runs")
def get_training_runs(model_id: int = None, db: Session = Depends(get_db)):
    query = db.query(TrainingRun)
    if model_id is not None:
        query = query.filter(TrainingRun.model_id == model_id)

    runs = query.all()

    return [
        {
            "id": r.id,
            "model_id": r.model_id,
            "epochs": r.epochs,
            "batch_size": r.batch_size,
            "learning_rate": r.learning_rate,
            "optimizer": r.optimizer,
            "train_accuracy": r.train_accuracy,
            "val_accuracy": r.val_accuracy,
            "model_path": r.model_path,
            "created_at": r.created_at
        }
        for r in runs
    ]




@router.get("/evaluation-results")
def get_evaluation_results(training_run_id: int = None, db: Session = Depends(get_db)):
    query = db.query(EvaluationResult)
    if training_run_id is not None:
        query = query.filter(EvaluationResult.training_run_id == training_run_id)

    results = query.all()

    return [
        {
            "id": r.id,
            "training_run_id": r.training_run_id,
            "perturbation_type": r.perturbation_type,
            "perturbation_level": r.perturbation_level,
            "accuracy": r.accuracy,
            "ece": r.ece,
            "avg_confidence": r.avg_confidence,
            "created_at": r.created_at
        }
        for r in results
    ]



@router.get("/prediction-logs")
def get_prediction_logs(db: Session = Depends(get_db)):
    logs = db.query(PredictionLog).all()

    return [
        {
            "id": l.id,
            "model_id": l.model_id,
            "predicted_label": l.predicted_label,
            "confidence": l.confidence,
            "input_source": l.input_source,
            "created_at": l.created_at
        }
        for l in logs
    ]

@router.get("/models/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == model_id).first()

    if model is None:
        return {"error": "Model not found"}

    return model