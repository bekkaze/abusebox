# AbuseBox open source blacklist monitoring tool

In order to prevent ISP organizations and organizations that operate using public addresses from the following risks, the web application has been developed as an open source, so that it is possible to check the blacklist, monitor all the addresses in the organization, and send a deslist request for automatic removal if it is blacklisted. Development was done using django-rest-framework on the backend and React/VITE on the frontend.

The following risks arise when a domain or network address is blacklisted:

- Due to blacklisting of the external address that is being NATed, users will be restricted from accessing the Internet
- Unable to receive and send emails
- Damage to your organization's reputation
- Inability to access certain services: If an IP address is blacklisted, it may be blocked from accessing certain websites or services.

### Getting Started

##### Backend

1. On local environment

```
# pip3 install poetry
# cd backend/
# poetry install
# poetry shell
(VIRTUAL SHELL)# cd src; python manage.py runserver 0.0.0.0:8000
```

and need change CORS_ALLOWED_ORIGINS in /backend/src/core/settings.py:

```
CORS_ALLOWED_ORIGINS = [
    "http://<FrontendIP>:3000",
]

```

2. With docker

```
cd backend
docker build -t abuse-backend .
docker run -p 8000:8000 -e FRONT_IP="http://fill_caller_domain" abuse-backend
```

##### Frontend

```
# cd frontend/
# yarn install
# yarn run dev
```

.env file for vite/react:

```
VITE_BASE_URL=http://<backendIP>:8000/
```

ToDo:

- Docker container deployment
- Add nginx
- Improve design
- Improve security
- PostgreSQL
