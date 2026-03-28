import os
import torch
import torch.nn.functional as F
from torchvision import datasets, transforms
from torchvision.transforms import functional as TF
import numpy as np
import random

from database.database import SessionLocal
from database.model_db import TrainingRun, EvaluationResult
from model_engine.MLPModel import MLPModel

# =========================
# Noise functions
# =========================

def add_gaussian_noise(image: torch.Tensor, std: float = 0.1):
    noise = torch.randn_like(image) * std
    return torch.clamp(image + noise, 0.0, 1.0)


def rotate_image(image: torch.Tensor, angle: float = 15):
    return TF.rotate(image, angle)


def blur_image(image: torch.Tensor, kernel_size: int = 3):
    blur = transforms.GaussianBlur(kernel_size=kernel_size)
    return blur(image)


def apply_random_perturbation(img: torch.Tensor):
    level = random.uniform(0.0, 0.5)
    choice = random.choice(["gaussian", "blur", "rotation"])

    if choice == "gaussian":
        img = add_gaussian_noise(img, std=level)
    elif choice == "blur":
        k = int(level * 5) + 1
        if k % 2 == 0:
            k += 1
        img = blur_image(img, kernel_size=k)
    elif choice == "rotation":
        angle = level * 30
        img = rotate_image(img, angle=angle)

    return img, choice, level

# =========================
# ECE
# =========================

def compute_ece(probs, labels, n_bins=10):
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)

    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0

    for i in range(n_bins):
        in_bin = (confidences > bins[i]) & (confidences <= bins[i+1])
        prop = np.mean(in_bin)

        if prop > 0:
            acc = np.mean(accuracies[in_bin])
            conf = np.mean(confidences[in_bin])
            ece += abs(acc - conf) * prop

    return ece

# =========================
# MAIN PIPELINE
# =========================

def run_evaluation_pipeline():
    print("Starting evaluation...")

    # Load MNIST
    transform = transforms.ToTensor()
    dataset = datasets.MNIST(root="data", train=False, download=True, transform=transform)

    sample_size = 1000
    indices = np.random.choice(len(dataset), sample_size, replace=False)

    images = []
    labels = []

    for idx in indices:
        img, label = dataset[idx]  # img = tensor (1,28,28)

        img, _, _ = apply_random_perturbation(img)

        images.append(img)
        labels.append(label)

    images_tensor = torch.stack(images)  # (N,1,28,28)
    labels = np.array(labels)

    # =========================
    # Load model
    # =========================
    db = SessionLocal()
    try:
        training_run = db.query(TrainingRun).order_by(TrainingRun.created_at.desc()).first()
        if training_run is None:
            raise RuntimeError("No training run found.")

        model_path = training_run.model_path
    finally:
        db.close()

    mlp = MLPModel()

    if model_path and os.path.exists(model_path):
        state = torch.load(model_path, map_location=mlp.device)
        mlp.model.load_state_dict(state)

    mlp.model.eval()

    # =========================
    # Inference
    # =========================
    with torch.no_grad():
        outputs = mlp.model(images_tensor.to(mlp.device))
        probs = F.softmax(outputs, dim=1).cpu().numpy()

    predictions = np.argmax(probs, axis=1)

    accuracy = np.mean(predictions == labels)
    avg_conf = np.mean(np.max(probs, axis=1))
    ece = compute_ece(probs, labels)

    print("Accuracy:", accuracy)
    print("Avg Confidence:", avg_conf)
    print("ECE:", ece)

    # =========================
    # Save DB
    # =========================
    db = SessionLocal()
    try:
        evaluation_record = EvaluationResult(
            training_run_id=training_run.id,
            perturbation_type="mixed",
            perturbation_level=0.0,
            accuracy=float(accuracy),
            ece=float(ece),
            avg_confidence=float(avg_conf)
        )
        db.add(evaluation_record)
        db.commit()
        db.refresh(evaluation_record)

        print(f"Saved evaluation_result id={evaluation_record.id}")
    finally:
        db.close()


if __name__ == '__main__':
    run_evaluation_pipeline()