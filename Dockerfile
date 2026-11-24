# Pinned to the multi-arch manifest-list digest of alpine:latest (resolved 2026-11-25).
# Refresh via Dependabot's docker ecosystem, or re-resolve explicitly:
#   docker buildx imagetools inspect alpine:latest
FROM alpine:latest@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf

ARG TARGETARCH
ARG TARGETVARIANT
WORKDIR /app
RUN apk add --no-cache tzdata
COPY ./${TARGETARCH}${TARGETVARIANT}/release /app/
VOLUME /app/data

EXPOSE 21114
CMD ["./apimain"]
