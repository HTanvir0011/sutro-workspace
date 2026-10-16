"""Maintained task-specific networks. Architectures follow the retained reference notebooks."""
import torch
from torch import nn
def block(i,o):return nn.Sequential(nn.Conv2d(i,o,3,padding=1,bias=False),nn.BatchNorm2d(o),nn.ReLU(),nn.Conv2d(o,o,3,padding=1,bias=False),nn.BatchNorm2d(o),nn.ReLU(),nn.MaxPool2d(2),nn.Dropout(.2))
def digit():return nn.Sequential(block(1,32),block(32,64),block(64,128),nn.Flatten(),nn.Linear(128*4*4,256),nn.ReLU(),nn.Dropout(.4),nn.Linear(256,10))
def conv(i,o):return nn.Sequential(nn.Conv2d(i,o,3,padding=1,bias=False),nn.BatchNorm2d(o),nn.ReLU())
class LineReader(nn.Module):
    def __init__(self,classes):
        super().__init__();self.cnn=nn.Sequential(conv(1,64),nn.MaxPool2d(2,2),conv(64,128),nn.MaxPool2d(2,2),conv(128,256),conv(256,256),nn.MaxPool2d((2,1),(2,1)),conv(256,384),conv(384,384),nn.MaxPool2d((2,1),(2,1)));self.rnn=nn.LSTM(384,256,num_layers=2,bidirectional=True,dropout=.25);self.fc=nn.Linear(512,classes)
    def forward(self,x):features=self.cnn(x).mean(2);out,_=self.rnn(features.permute(2,0,1));return self.fc(out).log_softmax(2)
