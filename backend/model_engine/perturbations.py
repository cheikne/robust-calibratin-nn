import torch
from torchvision.transforms import functional as F
from torchvision import transforms


def add_gaussian_noise(image: torch.Tensor, mean: float = 0.0, std: float = 0.1):
    noise = torch.randn_like(image) * std + mean
    noisy_image = image + noise
    return torch.clamp(noisy_image, 0.0, 1.0)


def rotate_image(image: torch.Tensor, angle: float = 15):
    return F.rotate(image, angle=angle)


def blur_image(image: torch.Tensor, kernel_size: int = 3):
    blur = transforms.GaussianBlur(kernel_size=kernel_size)
    return blur(image)


def pixel_corruption(image: torch.Tensor, corruption_prob: float = 0.1):
    corrupted = image.clone()
    mask = torch.rand_like(corrupted) < corruption_prob
    random_pixels = torch.rand_like(corrupted)
    corrupted[mask] = random_pixels[mask]
    return corrupted


def apply_perturbation(
    image: torch.Tensor,
    perturbation_type: str,
    perturbation_level: float
):
    if perturbation_type == "none":
        return image

    if perturbation_type == "gaussian_noise":
        return add_gaussian_noise(image, std=perturbation_level)

    if perturbation_type == "rotation":
        return rotate_image(image, angle=perturbation_level)

    if perturbation_type == "blur":
        kernel_size = int(max(3, perturbation_level))
        if kernel_size % 2 == 0:
            kernel_size += 1
        return blur_image(image, kernel_size=kernel_size)

    if perturbation_type == "pixel_corruption":
        return pixel_corruption(image, corruption_prob=perturbation_level)

    return image