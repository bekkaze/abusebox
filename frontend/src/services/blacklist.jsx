export const checkBlacklist = async (hostname) => {
  const response = await fetch(`http://localhost:8000/v1/blacklist/check?hostname=${hostname}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
 