import json


class Settings:
    def __init__(self, host, port):
        self.host = host
        self.port = port


def parse_config(path):
    data = json.load(open(path))
    return Settings(host=data["host"], port=data["port"])
