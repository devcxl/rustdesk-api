FROM alpine

ARG TARGETARCH
ARG TARGETVARIANT
WORKDIR /app
RUN apk add --no-cache tzdata
COPY ./${TARGETARCH}${TARGETVARIANT}/release /app/
VOLUME /app/data

EXPOSE 21114
CMD ["./apimain"]
