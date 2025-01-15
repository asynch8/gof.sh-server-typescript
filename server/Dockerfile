FROM node:18-bullseye-slim AS build
WORKDIR /app
COPY . /app
RUN npm install

# Production build, slimmed image.
#RUN npm run build
# Build maybe?
#FROM gcr.io/distroless/nodejs20-debian11
#COPY --from=0 /app/dist /usr/src/app
#COPY --from=0 /node_modules /usr/src/app/node_modules
#WORKDIR /usr/src/app