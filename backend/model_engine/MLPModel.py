import os
from typing import Dict, Optional

import torch
import torch.nn as nn
import torch.optim as optim

from database import SessionLocal
from database.model_db import Model, TrainingRun, EvaluationResult


class MLPNet(nn.Module):
    def __init__(self, input_size: int = 784, hidden_size: int = 128, num_classes: int = 10):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        # x shape: [batch_size, 1, 28, 28]
        x = x.view(x.size(0), -1)  # flatten -> [batch_size, 784]
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        return x


class MLPModel:
    def __init__(
        self,
        name: str = "MLP Baseline",
        description: str = "Basic MLP model for MNIST classification",
        input_size: int = 784,
        hidden_size: int = 128,
        num_classes: int = 10,
        learning_rate: float = 0.001,
        device: Optional[str] = None,
    ):
        self.name = name
        self.description = description
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_classes = num_classes
        self.learning_rate = learning_rate
        # self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")

        self.model = MLPNet(input_size, hidden_size, num_classes).to(self.device)
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(self.model.parameters(), lr=self.learning_rate)

    def train_model(self, train_loader, epochs: int = 5) -> Dict:
        self.model.train()

        final_loss = 0.0
        correct = 0
        total = 0

        for epoch in range(epochs):
            running_loss = 0.0
            epoch_correct = 0
            epoch_total = 0

            for images, labels in train_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)

                self.optimizer.zero_grad()
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                loss.backward()
                self.optimizer.step()

                running_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                epoch_total += labels.size(0)
                epoch_correct += (predicted == labels).sum().item()

            final_loss = running_loss / len(train_loader)
            correct = epoch_correct
            total = epoch_total

            print(
                f"Epoch [{epoch+1}/{epochs}] - "
                f"Loss: {final_loss:.4f} - "
                f"Accuracy: {100 * correct / total:.2f}%"
            )

        train_accuracy = correct / total if total > 0 else 0.0

        return {
            "epochs": epochs,
            "train_loss": final_loss,
            "train_accuracy": train_accuracy,
        }

    def evaluate_model(self, test_loader) -> Dict:
        self.model.eval()

        correct = 0
        total = 0
        total_confidence = 0.0

        with torch.no_grad():
            for images, labels in test_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)

                outputs = self.model(images)
                probabilities = torch.softmax(outputs, dim=1)
                confidences, predicted = torch.max(probabilities, dim=1)

                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                total_confidence += confidences.sum().item()

        accuracy = correct / total if total > 0 else 0.0
        avg_confidence = total_confidence / total if total > 0 else 0.0

        return {
            "accuracy": accuracy,
            "avg_confidence": avg_confidence,
        }

    def predict(self, image_tensor):
        self.model.eval()
        with torch.no_grad():
            image_tensor = image_tensor.to(self.device)
            outputs = self.model(image_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, dim=1)

        return {
            "predicted_label": predicted.item(),
            "confidence": confidence.item(),
        }

    def save_model(self, folder: str = "saved_models") -> str:
        os.makedirs(folder, exist_ok=True)
        model_path = os.path.join(folder, f"{self.name.replace(' ', '_').lower()}.pt")
        torch.save(self.model.state_dict(), model_path)
        return model_path

    def create_model_record(self) -> int:
        db = SessionLocal()
        try:
            db_model = Model(
                name=self.name,
                model_type="MLP",
                description=self.description,
            )
            db.add(db_model)
            db.commit()
            db.refresh(db_model)
            return db_model.id
        finally:
            db.close()

    def save_training_run(
        self,
        model_id: int,
        epochs: int,
        batch_size: int,
        optimizer_name: str,
        train_accuracy: float,
        val_accuracy: float,
        model_path: str,
    ) -> int:
        db = SessionLocal()
        try:
            training_run = TrainingRun(
                model_id=model_id,
                epochs=epochs,
                batch_size=batch_size,
                learning_rate=self.learning_rate,
                optimizer=optimizer_name,
                train_accuracy=train_accuracy,
                val_accuracy=val_accuracy,
                model_path=model_path,
            )
            db.add(training_run)
            db.commit()
            db.refresh(training_run)
            return training_run.id
        finally:
            db.close()

    def save_evaluation_result(
        self,
        training_run_id: int,
        perturbation_type: str,
        perturbation_level: float,
        accuracy: float,
        ece: float,
        avg_confidence: float,
    ) -> int:
        db = SessionLocal()
        try:
            evaluation_result = EvaluationResult(
                training_run_id=training_run_id,
                perturbation_type=perturbation_type,
                perturbation_level=perturbation_level,
                accuracy=accuracy,
                ece=ece,
                avg_confidence=avg_confidence,
            )
            db.add(evaluation_result)
            db.commit()
            db.refresh(evaluation_result)
            return evaluation_result.id
        finally:
            db.close()