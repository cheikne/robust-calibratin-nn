from pydantic import BaseModel


class PredictionRequest(BaseModel):
    image: str
    perturbation_type: str = "none"
    perturbation_level: float = 0.0
    model_type: str = "mlp"


class PredictionResponse(BaseModel):
    predicted_label: int
    confidence: float
    perturbation_type: str
    perturbation_level: float
    model_type: str