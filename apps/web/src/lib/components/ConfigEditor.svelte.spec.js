import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConfigEditor from './ConfigEditor.svelte';

/** @returns {import('$lib/config.svelte.js').StreamlingConfig} */
function makeConfig() {
	return {
		energy: {
			tickRateMs: 10000,
			baselineAlpha: 0.05,
			energyAlpha: 0.02,
			minStdDev: 0.1,
			stdDevWindowSize: 60,
			messageWeight: 1.0,
			chatterWeight: 0.7,
			highValueWeight: 3.0
		},
		moodTransition: {
			sleepToIdleEnergyThreshold: -0.5,
			sleepToIdleMinDuration: 600000,
			sleepToIdleHoldTime: 120000,
			idleToEngagedEnergyThreshold: 0.5,
			idleToEngagedHoldTime: 90000,
			engagedToPartyingEnergyThreshold: 1.5,
			engagedToPartyingHoldTime: 120000,
			partyingToEngagedEnergyThreshold: 1.2,
			partyingToEngagedMaxDuration: 600000,
			partyingToEngagedHoldTime: 60000,
			engagedToIdleEnergyThreshold: 0.3,
			engagedToIdleHoldTime: 180000,
			idleToSleepingEnergyThreshold: -0.8,
			idleToSleepingHoldTime: 600000
		},
		internalDrive: {
			sleepPressureRate: 0.001,
			restednessRate: 0.002,
			exhaustionRate: 0.01,
			curiosityRate: 0.0005,
			sleepPressureThreshold: 0.8,
			restednessThreshold: 0.9,
			exhaustionThreshold: 0.85
		}
	};
}

describe('ConfigEditor', () => {
	const defaultProps = () => ({
		config: makeConfig(),
		saving: false,
		onsave: vi.fn()
	});

	describe('renders all three setting groups', () => {
		it('renders Energy Settings section', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Energy Settings')).toBeInTheDocument();
		});

		it('renders Mood Transitions section', async () => {
			render(ConfigEditor, defaultProps());
			await expect
				.element(page.getByRole('heading', { name: 'Mood Transitions' }))
				.toBeInTheDocument();
		});

		it('renders Internal Drives section', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Internal Drives')).toBeInTheDocument();
		});
	});

	describe('human-readable labels', () => {
		it('shows Message Weight label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Message Weight')).toBeInTheDocument();
		});

		it('shows Chatter Weight label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Chatter Weight')).toBeInTheDocument();
		});

		it('shows High-Value Event Weight label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('High-Value Event Weight')).toBeInTheDocument();
		});

		it('shows Baseline Smoothing label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Baseline Smoothing')).toBeInTheDocument();
		});

		it('shows Energy Smoothing label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Energy Smoothing')).toBeInTheDocument();
		});

		it('shows Sleep Pressure Rate label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Sleep Pressure Rate')).toBeInTheDocument();
		});

		it('shows Restedness Rate label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Restedness Rate')).toBeInTheDocument();
		});

		it('shows Exhaustion Rate label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Exhaustion Rate')).toBeInTheDocument();
		});

		it('shows Curiosity Rate label', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Curiosity Rate')).toBeInTheDocument();
		});
	});

	describe('default values displayed', () => {
		it('shows default message weight', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('default: 1', { exact: true })).toBeInTheDocument();
		});

		it('shows default chatter weight', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('default: 0.7')).toBeInTheDocument();
		});

		it('shows default high-value weight', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('default: 3')).toBeInTheDocument();
		});

		it('shows default baseline alpha', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('default: 0.05')).toBeInTheDocument();
		});

		it('shows default energy alpha', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('default: 0.02')).toBeInTheDocument();
		});
	});

	describe('current values displayed', () => {
		it('shows current message weight value', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('1.0')).toBeInTheDocument();
		});

		it('shows current chatter weight value', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('0.7', { exact: true })).toBeInTheDocument();
		});

		it('shows current high-value weight value', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('3.0')).toBeInTheDocument();
		});
	});

	describe('Save button', () => {
		it('renders Save Changes button', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Save Changes')).toBeInTheDocument();
		});

		it('shows Saving... when saving is true', async () => {
			render(ConfigEditor, { ...defaultProps(), saving: true });
			await expect.element(page.getByText('Saving...')).toBeInTheDocument();
		});

		it('calls onsave when Save Changes is clicked', async () => {
			const props = defaultProps();
			render(ConfigEditor, props);
			const btn = page.getByText('Save Changes');
			await btn.click();
			expect(props.onsave).toHaveBeenCalledOnce();
		});
	});

	describe('slider inputs', () => {
		it('renders range inputs for energy settings', async () => {
			const { container } = render(ConfigEditor, defaultProps());
			const energySection = container.querySelector('[data-testid="energy-settings"]');
			const sliders = energySection?.querySelectorAll('input[type="range"]');
			expect(sliders?.length).toBe(5);
		});

		it('renders range inputs for internal drive settings', async () => {
			const { container } = render(ConfigEditor, defaultProps());
			const driveSection = container.querySelector('[data-testid="internal-drives-settings"]');
			const sliders = driveSection?.querySelectorAll('input[type="range"]');
			expect(sliders?.length).toBe(7);
		});
	});

	describe('mood transition groups', () => {
		it('shows Sleeping to Idle group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Sleeping to Idle')).toBeInTheDocument();
		});

		it('shows Idle to Engaged group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Idle to Engaged')).toBeInTheDocument();
		});

		it('shows Engaged to Partying group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Engaged to Partying')).toBeInTheDocument();
		});

		it('shows Partying to Engaged group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Partying to Engaged')).toBeInTheDocument();
		});

		it('shows Engaged to Idle group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Engaged to Idle')).toBeInTheDocument();
		});

		it('shows Idle to Sleeping group', async () => {
			render(ConfigEditor, defaultProps());
			await expect.element(page.getByText('Idle to Sleeping')).toBeInTheDocument();
		});
	});

	describe('helpful descriptions', () => {
		it('describes what message weight controls', async () => {
			render(ConfigEditor, defaultProps());
			await expect
				.element(page.getByText('How much each chat message contributes to the activity signal.'))
				.toBeInTheDocument();
		});

		it('describes energy threshold for sleeping to idle', async () => {
			render(ConfigEditor, defaultProps());
			await expect
				.element(page.getByText('Energy level that can wake the streamling from sleep.'))
				.toBeInTheDocument();
		});

		it('describes sleep pressure rate', async () => {
			render(ConfigEditor, defaultProps());
			await expect
				.element(
					page.getByText('Rate at which sleep pressure builds while the streamling is awake.')
				)
				.toBeInTheDocument();
		});
	});
});
