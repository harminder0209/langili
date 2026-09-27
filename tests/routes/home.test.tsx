import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import Home from '../../app/index';

describe('Home route', () => {
  it('shows the Langili name at /', async () => {
    const router = renderRouter({ _layout: RootLayout, index: Home }, { initialUrl: '/' });
    // React Native Testing Library 14 renders asynchronously; renderRouter still returns its promise.
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByRole('heading', { name: 'Langili' })).toBeOnTheScreen();
  });
});
