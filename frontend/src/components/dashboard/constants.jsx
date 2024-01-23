import {
	HiOutlineViewGrid,
	HiDesktopComputer,
	HiCheck,
	HiOutlineQuestionMarkCircle,
	HiOutlineCog
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
	}
]

export const DASHBOARD_SIDEBAR_BOTTOM_LINKS = [
	{
		key: 'settings',
		label: 'Settings',
		path: '/settings',
		icon: <HiOutlineCog />
	},
	{
		key: 'support',
		label: 'Help & Support',
		path: '/support',
		icon: <HiOutlineQuestionMarkCircle />
	}
]