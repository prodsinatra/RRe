export async function fetchApi(url: string, options: RequestInit = {}) {
  const mockUserStr = localStorage.getItem("mock_user");
  let token = "";
  if (mockUserStr) {
    try {
      const mockUser = JSON.parse(mockUserStr);
      token = mockUser.id;
    } catch (e) {}
  }
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const res = await fetch(url, { ...options, headers });
  
  // If it's a 401/403, we could handle it here
  if (res.status === 401) {
    console.error("Authentication required");
  }
  
  // Quick fix for HTML responses incorrectly returned on 404
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error(`Unexpected HTML response from API: ${url}`);
  }
  
  return res;
}
