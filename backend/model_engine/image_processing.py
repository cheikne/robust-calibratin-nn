import base64
import io

from PIL import Image, ImageOps
import torch
from torchvision import transforms
import cv2 
import numpy as np


def base64_to_pil(base64_string: str) -> Image.Image:
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]

    image_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_data)).convert("L")
    return image


def preprocess_pil_image(image: Image.Image) -> torch.Tensor:
    # If the image background is light (mean intensity high), invert so that
    # we have dark background and light digit like MNIST. This handles both
    # cases where the frontend produced white background or black background.
    stat = Image.Image.getextrema(image)
    # compute a simple mean estimate
    try:
        avg = sum(image.getdata()) / (image.width * image.height)
    except Exception:
        avg = 0
    if avg > 127:
        image = ImageOps.invert(image)

    image = image.resize((28, 28))

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])

    tensor = transform(image)
    tensor = tensor.unsqueeze(0)  # shape: [1, 1, 28, 28]
    return tensor


def base64_to_tensor(base64_string: str) -> torch.Tensor:
    image = base64_to_pil(base64_string)
    return preprocess_pil_image(image)

def center_digit(image: np.ndarray):
    """
    image: numpy array (H, W) grayscale [0-255]
    """

    # Binarize
    _, thresh = cv2.threshold(image, 20, 255, cv2.THRESH_BINARY)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if len(contours) == 0:
        return image  # no digit found

    # Largest contour
    cnt = max(contours, key=cv2.contourArea)

    x, y, w, h = cv2.boundingRect(cnt)

    # Crop digit
    digit = image[y:y+h, x:x+w]

    # Resize to 20x20 (like MNIST preprocessing)
    digit = cv2.resize(digit, (20, 20))

    # Create blank 28x28 image
    canvas = np.zeros((28, 28), dtype=np.uint8)

    # Center position
    x_offset = (28 - 20) // 2
    y_offset = (28 - 20) // 2

    canvas[y_offset:y_offset+20, x_offset:x_offset+20] = digit

    return canvas