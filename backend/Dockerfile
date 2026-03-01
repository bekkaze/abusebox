FROM python:alpine3.19

WORKDIR /app
RUN apk update 
RUN pip install poetry
RUN poetry config virtualenvs.create false 

COPY poetry.lock pyproject.toml ./
RUN poetry install --no-interaction --no-ansi --without dev
COPY . ./
EXPOSE 8000

CMD ["sh", "-c", "python /app/src/manage.py migrate && python /app/src/manage.py runserver 0.0.0.0:8000"]
