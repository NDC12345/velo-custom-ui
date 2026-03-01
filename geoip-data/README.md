# GeoIP Data Directory

This directory is volume-mounted into the backend container at `/geoip`.

## Required File

`GeoLite2-City.mmdb` — MaxMind GeoLite2 City database (~70MB binary)

## Download Instructions

1. Register free at https://www.maxmind.com/en/geolite2/signup
2. Log in → **Download Files** → **GeoLite2 City** → Download **GeoLite2-City.mmdb.gz**
3. Extract: `gunzip GeoLite2-City.mmdb.gz`
4. Place the extracted `GeoLite2-City.mmdb` in this directory

## Without MMDB

The backend will automatically fall back to the ip-api.com batch API (free, 45 req/min limit).
Private/RFC-1918 IPs are always resolved to `{lat:0, lng:0, country_code:'XX'}`.

## License

GeoLite2 databases are subject to MaxMind's GeoLite2 End User License Agreement.
See https://www.maxmind.com/en/geolite2/eula
