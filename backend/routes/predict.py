from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import recognizer

router = APIRouter(prefix="/api", tags=["recognition"])

TRAIN_HINT = {
    "numbers": "python ml/step4_train.py",
    "letters": "python ml/step4_train_letters.py",
}


class Frame(BaseModel):
    image: str                 # a JPEG as a base64 data URL, sent by the browser
    kind: str = "numbers"      # "numbers" or "letters"


def get_rec_or_503(kind):
    if kind not in recognizer.KINDS:
        raise HTTPException(status_code=400, detail=f"Unknown kind '{kind}'")
    rec = recognizer.get_recognizer(kind)
    if rec is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not found. Train it first: {TRAIN_HINT[kind]}",
        )
    return rec


@router.get("/model-info")
def model_info(kind: str = "numbers"):
    return {"classes": get_rec_or_503(kind).classes}


@router.post("/predict")
def predict(frame: Frame):
    try:
        return get_rec_or_503(frame.kind).predict(frame.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))