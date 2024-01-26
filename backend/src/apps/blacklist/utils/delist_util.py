from typing import Tuple
import requests 

def barracudacentral(target: str, email: str, phone: str, comments: str) -> Tuple[bool, dict]:
  print('[i] Trying delist: barracudacentral')
  response = requests.get(f'https://www.barracudacentral.org/rbl/removal-request/{target}')
  cid = response.text.split('"cid" value="')[1].split('" />')[0]
  print(f'CID: {cid}')

  headers = {
    'Host': 'www.barracudacentral.org',
    'Origin': 'https://www.barracudacentral.org',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Referer': f'https://www.barracudacentral.org/rbl/removal-request/{target}',
  }

  data = {
    'address': target,
    'email': email,
    'phone': phone,
    'comments': comments,
    'cid': cid,
    'submit': 'Submit Request',
  }

  response = requests.post(
    'https://www.barracudacentral.org/rbl/removal-request',
    headers=headers,
    data=data,
    verify=False,
  )


  if 'Your confirmation number is ' in response.text: 
    confirmation_number = response.text.split('Your confirmation number is ')[1].split('.')[0]
    print(f'[i] Request sent, IP: {target}. Confirmation number: {confirmation_number}')
    return True, confirmation_number 
  else: 
    print(f'[-] Error: {target}')
    return False, None