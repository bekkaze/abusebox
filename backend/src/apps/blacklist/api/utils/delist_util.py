
from typing import Tuple
import requests 

def barracudacentral(target: str) -> Tuple[bool, str]:
  print('[i] Trying delist: barracudacentral')
  response = requests.get(f'https://www.barracudacentral.org/rbl/removal-request/{target}')
  cid = response.text.split('"cid" value="')[1].split('" />')[0]
  print(f'CID: {cid}')

  cookies = {
    '__utma': '241654417.1041471903.1687768476.1687768476.1687768476.1',
    '__utmc': '241654417',
    '__utmz': '241654417.1687768476.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none)',
    '__utmt': '1',
    '__utmb': '241654417.1.10.1687768476',
  }

  headers = {
    'Host': 'www.barracudacentral.org',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="109", "Not_A Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Upgrade-Insecure-Requests': '1',
    'Origin': 'https://www.barracudacentral.org',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Referer': f'https://www.barracudacentral.org/rbl/removal-request/{target}',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  data = {
    'address': target,
    'email': 'bilguunhz@gmail.com',
    'phone': '86110000',
    'comments': 'Dear,\r\n\r\nWe are ISP Company in Mongolia. And we check our addresses in our end. There is no issue. Can you remove our IP addresses from Barracuda blacklist.\r\n\r\nBR,\r\nBilguun',
    'cid': cid,
    'submit': 'Submit Request',
  }

  response = requests.post(
    'https://www.barracudacentral.org/rbl/removal-request',
    cookies=cookies,
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

#print(barracudacentral('202.70.46.10'))