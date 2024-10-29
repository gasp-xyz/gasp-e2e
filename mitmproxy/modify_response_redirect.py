from mitmproxy import http
#mitmproxy -s modify_response_redirect.py -p 4050
# Define the target URL to redirect to
TARGET_URL = "0.0.0.0"
#TARGET_URL="d379ef45-96ca-4b0a-8989-f9c870e3c9cc.mock.pstmn.io/foo"

def request(flow: http.HTTPFlow) -> None:
    # Redirect the request to the target URL
    #if flow.request.host == "original-service.com":  # Original service host
    flow.request.host = TARGET_URL        # Redirected service host
    flow.request.port = 8090                     # Port (443 for HTTPS)
    #flow.request.text = flow.request.text.replace("0x000","0x111")
    request_data = json.loads(flow.request.text)
    print(request)

def response(flow: http.HTTPFlow) -> None:
    # Modify the response body if it's from the new redirected service
    #if flow.request.host == "new-service.com":
    print(flow.response.text)
    flow.response.text = flow.response.text.replace("a", "b")
    print(flow.response.text)
