# Pinned by digest like the frontend image; Dependabot keeps it current.
FROM python:3.11.17-alpine@sha256:5fb4bc53dd0180955e31e5245b648bbb24a4ac4ab03a1de81513642325220bcd AS build

# Compilers are needed only to build wheels, so they stay in this stage.
RUN apk add --no-cache build-base libffi-dev
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11.17-alpine@sha256:5fb4bc53dd0180955e31e5245b648bbb24a4ac4ab03a1de81513642325220bcd

# su-exec lets the entrypoint fix the data volume's owner, then drop root.
RUN apk add --no-cache libffi su-exec \
    && adduser -D -H -u 10001 abusebox
COPY --from=build /install /usr/local

WORKDIR /app
COPY . ./
RUN mkdir -p /app/data && chown abusebox:abusebox /app/data

EXPOSE 8100

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
