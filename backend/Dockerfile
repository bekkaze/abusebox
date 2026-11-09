# Pinned by digest like the frontend image; Dependabot keeps it current.
FROM python:3.11.18-alpine@sha256:09d17d5e4c16d0a7a1eea690bcb7c6ab8616b211f8421e429e97c1bef5bd0ed2 AS build

# Compilers are needed only to build wheels, so they stay in this stage.
RUN apk add --no-cache build-base libffi-dev
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11.18-alpine@sha256:09d17d5e4c16d0a7a1eea690bcb7c6ab8616b211f8421e429e97c1bef5bd0ed2

# su-exec lets the entrypoint fix the data volume's owner, then drop root.
RUN apk add --no-cache libffi su-exec \
    && adduser -D -H -u 10001 abusebox
COPY --from=build /install /usr/local

WORKDIR /app
COPY . ./
RUN mkdir -p /app/data && chown abusebox:abusebox /app/data

EXPOSE 8100

# Compose and orchestrators need a readiness signal: without one the frontend
# starts proxying to a backend that is still running migrations. Python rather
# than curl/wget, which this image does not carry.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=4).status == 200 else 1)"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
