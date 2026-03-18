import {
	HiOutlineViewGrid,
	HiDesktopComputer,
	HiCheck,
	HiOutlineQuestionMarkCircle,
	HiShieldExclamation,
	HiGlobe,
	HiStatusOnline
} from 'react-icons/hi'

export const DASHBOARD_SIDEBAR_LINKS = [
	{
		key: 'dashboard',
		label: 'Dashboard',
		path: '/dashboard',
		icon: <HiOutlineViewGrid />
	},
	{
		key: 'blacklist-monitor',
		label: 'Blacklist monitor',
		path: '/dashboard/blacklist-monitor',
		icon: <HiDesktopComputer />
	},
	{
		key: 'blacklist-check',
		label: 'Blacklist check',
		path: '/dashboard/blacklist-check',
		icon: <HiCheck />
	},
	{
		key: 'abuseipdb',
		label: 'AbuseIPDB',
		path: '/dashboard/abuseipdb',
		icon: <HiShieldExclamation />
	},
	{
		key: 'whois',
		label: 'WHOIS Lookup',
		path: '/dashboard/whois',
		icon: <HiGlobe />
	},
	{
		key: 'server-status',
		label: 'Is Server Up?',
		path: '/dashboard/server-status',
		icon: <HiStatusOnline />
	}
]

export const DASHBOARD_SIDEBAR_BOTTOM_LINKS = [
	{
		key: 'support',
		label: 'API Docs',
		path: 'http://localhost:8100/swagger/',
		icon: <HiOutlineQuestionMarkCircle />
	}
]
