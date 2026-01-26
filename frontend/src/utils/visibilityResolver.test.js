import { resolveVisibility } from './visibilityResolver';

const guestContext = {
  userId: 'guest',
  role: 'guest',
  isAuthenticated: true,
  isGuest: true,
  isAdmin: false,
  canWrite: false,
};

const adminContext = {
  userId: 1,
  role: 'администратор',
  isAuthenticated: true,
  isGuest: false,
  isAdmin: true,
  canWrite: true,
};

describe('visibility resolver', () => {
  test('deny rule hides for guest', () => {
    const config = {
      rules: [
        {
          id: 'hide-tools-guest',
          scope: 'route',
          target: '/info',
          action: 'deny',
          when: { isGuest: true },
        },
      ],
    };

    expect(
      resolveVisibility({ config, scope: 'route', target: '/info', userContext: guestContext })
    ).toBe(false);
    expect(
      resolveVisibility({ config, scope: 'route', target: '/info', userContext: adminContext })
    ).toBe(true);
  });

  test('specific allow beats general deny', () => {
    const config = {
      rules: [
        {
          id: 'deny-all-wine',
          scope: 'pageBlock',
          target: 'home.tile.wine',
          action: 'deny',
          when: { everyone: true },
        },
        {
          id: 'allow-admin-wine',
          scope: 'pageBlock',
          target: 'home.tile.wine',
          action: 'allow',
          when: { roles: ['администратор'] },
        },
      ],
    };

    expect(
      resolveVisibility({ config, scope: 'pageBlock', target: 'home.tile.wine', userContext: guestContext })
    ).toBe(false);
    expect(
      resolveVisibility({ config, scope: 'pageBlock', target: 'home.tile.wine', userContext: adminContext })
    ).toBe(true);
  });

  test('deny wins when specificity is equal', () => {
    const config = {
      rules: [
        {
          id: 'allow-guest',
          scope: 'menuItem',
          target: 'footer.favorites',
          action: 'allow',
          when: { isGuest: true },
        },
        {
          id: 'deny-guest',
          scope: 'menuItem',
          target: 'footer.favorites',
          action: 'deny',
          when: { isGuest: true },
        },
      ],
    };

    expect(
      resolveVisibility({ config, scope: 'menuItem', target: 'footer.favorites', userContext: guestContext })
    ).toBe(false);
  });
});
