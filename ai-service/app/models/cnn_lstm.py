"""
CNN-LSTM Speech Model Architecture (Modular Interface)

This module defines the PyTorch CNN-LSTM neural architecture for acoustic feature
processing and speech delivery evaluation.

Note on Training Status:
- Architecture defined for modularity and future model weight integration.
- If pretrained/trained weights are provided at AUDIO_MODEL_PATH, this network is used.
- Otherwise, the service gracefully falls back to deterministic librosa feature extraction.
"""

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


if TORCH_AVAILABLE:
    class CNNLSTMSpeechModel(nn.Module):
        def __init__(self, num_mfcc=13, hidden_dim=64, num_layers=2, num_classes=1, dropout=0.3):
            super().__init__()
            # 1D Convolutional feature extractor over time frames
            self.conv_block = nn.Sequential(
                nn.Conv1d(in_channels=num_mfcc, out_channels=32, kernel_size=3, padding=1),
                nn.BatchNorm1d(32),
                nn.ReLU(),
                nn.MaxPool1d(kernel_size=2),
                nn.Dropout(dropout),
                nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3, padding=1),
                nn.BatchNorm1d(64),
                nn.ReLU(),
                nn.MaxPool1d(kernel_size=2),
                nn.Dropout(dropout),
            )
            # Bidirectional LSTM to capture temporal context
            self.lstm = nn.LSTM(
                input_size=64,
                hidden_size=hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=True,
                dropout=dropout if num_layers > 1 else 0
            )
            # Fully connected regressor for delivery indicator score
            self.fc = nn.Sequential(
                nn.Linear(hidden_dim * 2, 32),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(32, num_classes),
                nn.Sigmoid()  # normalized score (0.0 to 1.0)
            )

        def forward(self, x):
            # Input x: [batch, num_mfcc, time_steps]
            conv_out = self.conv_block(x)  # [batch, 64, time_steps // 4]
            lstm_in = conv_out.permute(0, 2, 1)  # [batch, time_steps // 4, 64]
            lstm_out, _ = self.lstm(lstm_in)
            # Global pooling over sequence length
            pooled = torch.mean(lstm_out, dim=1)
            out = self.fc(pooled)
            return out
else:
    class CNNLSTMSpeechModel:
        def __init__(self, *args, **kwargs):
            raise ImportError("PyTorch is required to instantiate CNNLSTMSpeechModel.")
