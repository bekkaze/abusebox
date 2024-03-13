FROM python:alpine3.19

WORKDIR /app
RUN apk update 
RUN pip install poetry
RUN poetry config virtualenvs.create false 

COPY poetry.lock pyproject.toml ./
RUN poetry install --no-interaction --no-ansi -vvv
COPY . ./

CMD ["python", "/app/src/manage.py", "runserver", "0.0.0.0:8000"]