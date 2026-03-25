import {
	HiOutlineViewGrid,
	HiDesktopComputer,
	HiCheck,
	HiOutlineQuestionMarkCircle,
	HiShieldExclamation,
	HiGlobe,
	HiStatusOnline,
	HiServer,
	HiLockClosed,
	HiMail,
	HiViewList,
	HiCollection,
	HiDocumentReport,
} from 'react-icons/hi'

export const DASHBOARD_SIDEBAR_SECTIONS = [
	{
		label: 'Monitor',
		links: [
			{
				key: 'dashboard',
				label: 'Dashboard',
				path: '/dashboard',
				icon: <HiOutlineViewGrid />
			},
			{
				key: 'assets',
				label: 'Assets',
				path: '/dashboard/assets',
				icon: <HiDesktopComputer />
			},
		],
	},
	{
		label: 'Check & Lookup',
		links: [
			{
				key: 'blacklist-check',
				label: 'Blacklist Check',
				path: '/dashboard/blacklist-check',
				icon: <HiCheck />
			},
			{
				key: 'bulk-check',
				label: 'Bulk Check',
				path: '/dashboard/bulk-check',
				icon: <HiCollection />
			},
			{
				key: 'subnet-check',
				label: 'Subnet / CIDR',
				path: '/dashboard/subnet-check',
				icon: <HiViewList />
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
				key: 'dns-records',
				label: 'DNS Records',
				path: '/dashboard/dns-records',
				icon: <HiServer />
			},
			{
				key: 'ssl-checker',
				label: 'SSL Checker',
				path: '/dashboard/ssl-checker',
				icon: <HiLockClosed />
			},
			{
				key: 'email-security',
				label: 'SPF/DKIM/DMARC',
				path: '/dashboard/email-security',
				icon: <HiMail />
			},
			{
				key: 'dmarc-reports',
				label: 'DMARC Reports',
				path: '/dashboard/dmarc-reports',
				icon: <HiDocumentReport />
			},
			{
				key: 'server-status',
				label: 'Is Server Up?',
				path: '/dashboard/server-status',
				icon: <HiStatusOnline />
			},
		],
	},
]

export const DASHBOARD_SIDEBAR_BOTTOM_LINKS = [
	{
		key: 'support',
		label: 'API Docs',
		path: `${import.meta.env.VITE_API_DOCS_URL || 'http://localhost:8100/swagger/'}`,
		icon: <HiOutlineQuestionMarkCircle />
	}
]
