FROM python:3.11-alpine

WORKDIR /app

RUN apk add --no-cache build-base libffi-dev
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
