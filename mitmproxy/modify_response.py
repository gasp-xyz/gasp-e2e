from mitmproxy import http

#mitmproxy -s modify_response.py
def response(flow: http.HTTPFlow) -> None:
    #if "example.com" in flow.request.pretty_host:
        # modify response body
    flow.response.text = flow.response.text.replace("a", "b")

