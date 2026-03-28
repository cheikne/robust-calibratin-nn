from model_engine.MLPModel import MLPModel
import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.payload import PredictionRequest, PredictionResponse
from model_engine.MLPModel import MLPModel
from model_engine.image_processing import base64_to_tensor
from model_engine.perturbations import apply_perturbation
from api import api_controller

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup ----
    print("[FastAPI] Database connection opened at startup")

    yield

    # ---- Shutdown ----
    print("[FastAPI] Database connection closed at shutdown")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_controller.router)
# mlp_model = MLPModel(model_path="saved_models/mlp_baseline.pt")


@app.get("/")
def root():
    return {"message": "API is running"}
# mlp = MLPModel()

# transform = transforms.Compose([
#     transforms.ToTensor(),
#     transforms.Normalize((0.1307,), (0.3081,))
# ])

# train_dataset = datasets.MNIST(
#     root="./data",
#     train=True,
#     download=True,
#     transform=transform
# )

# test_dataset = datasets.MNIST(
#     root="./data",
#     train=False,
#     download=True,
#     transform=transform
# )
# train_loader = DataLoader(
#     train_dataset,
#     batch_size=64,
#     shuffle=True
# )

# test_loader = DataLoader(
#     test_dataset,
#     batch_size=64,
#     shuffle=False
# )
# # 1. Create model record in DB
# model_id = mlp.create_model_record()

# # 2. Train
# train_metrics = mlp.train_model(train_loader, epochs=5)

# # 3. Evaluate
# eval_metrics = mlp.evaluate_model(test_loader)

# # 4. Save .pt model
# model_path = mlp.save_model()

# # 5. Save training run
# training_run_id = mlp.save_training_run(
#     model_id=model_id,
#     epochs=5,
#     batch_size=64,
#     optimizer_name="Adam",
#     train_accuracy=train_metrics["train_accuracy"],
#     val_accuracy=eval_metrics["accuracy"],
#     model_path=model_path,
# )

# # 6. Save evaluation result
# mlp.save_evaluation_result(
#     training_run_id=training_run_id,
#     perturbation_type="none",
#     perturbation_level=0.0,
#     accuracy=eval_metrics["accuracy"],
#     ece=0.0,  # placeholder for now
#     avg_confidence=eval_metrics["avg_confidence"],
# )

if __name__ == "__main__":
    import uvicorn
    print("PyTorch version:", torch.__version__)
    uvicorn.run(app, host="0.0.0.0", port=8000)