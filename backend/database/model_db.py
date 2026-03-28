from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database.database import Base


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    model_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    epochs = Column(Integer)
    batch_size = Column(Integer)
    learning_rate = Column(Float)
    optimizer = Column(String)
    train_accuracy = Column(Float)
    val_accuracy = Column(Float)
    model_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(Integer, primary_key=True, index=True)
    training_run_id = Column(Integer, ForeignKey("training_runs.id"), nullable=False)
    perturbation_type = Column(String)
    perturbation_level = Column(Float)
    accuracy = Column(Float)
    ece = Column(Float)
    avg_confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    predicted_label = Column(Integer)
    confidence = Column(Float)
    input_source = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())