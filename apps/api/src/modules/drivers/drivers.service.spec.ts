import { ConflictException, NotFoundException } from '@nestjs/common';
import { DriverStatus, UserRole } from '@prisma/client';
import { DriversService } from './drivers.service';

const baseDriver = {
  id: 'driver-1',
  name: 'Luis Andrade',
  phone: null,
  licenseNumber: null,
  status: DriverStatus.ACTIVE,
  userId: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: null as { email: string } | null,
};

function setup() {
  const tx = {
    driver: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    session: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { logAction: jest.fn() };
  const service = new DriversService(prisma as never, audit as never);
  return { service, tx, audit };
}

describe('DriversService account linking', () => {
  it('creates a DRIVER account for a new email and links it', async () => {
    const { service, tx, audit } = setup();
    tx.driver.findUnique.mockResolvedValue(baseDriver);
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: 'user-9' });
    tx.driver.update.mockResolvedValue({ ...baseDriver, userId: 'user-9', user: { email: 'luis@gmail.com' } });

    const result = await service.linkAccount('driver-1', { email: 'luis@gmail.com' }, 'admin-1');

    expect(tx.user.create).toHaveBeenCalledWith({
      data: { email: 'luis@gmail.com', role: UserRole.DRIVER, name: 'Luis Andrade' },
    });
    expect(tx.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'driver-1' }, data: { userId: 'user-9' } }),
    );
    expect(result.accountEmail).toBe('luis@gmail.com');
    expect(audit.logAction).toHaveBeenCalledWith('admin-1', 'LINK_ACCOUNT', 'Driver', 'driver-1', {
      email: 'luis@gmail.com',
    });
  });

  it('promotes an existing student account to DRIVER', async () => {
    const { service, tx } = setup();
    tx.driver.findUnique.mockResolvedValue(baseDriver);
    tx.user.findUnique.mockResolvedValue({
      id: 'user-2',
      role: UserRole.STUDENT,
      isActive: true,
      name: 'Ana Pérez',
      driverProfile: null,
    });
    tx.user.update.mockResolvedValue({ id: 'user-2' });
    tx.driver.update.mockResolvedValue({ ...baseDriver, userId: 'user-2', user: { email: 'ana@est.ups.edu.ec' } });

    await service.linkAccount('driver-1', { email: 'ana@est.ups.edu.ec' }, 'admin-1');

    // Conserva el nombre que el usuario ya tenía.
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { role: UserRole.DRIVER, name: 'Ana Pérez' },
    });
  });

  it.each([
    ['an admin account', { id: 'u', role: UserRole.ADMIN, isActive: true, driverProfile: null }],
    ['a super admin account', { id: 'u', role: UserRole.SUPER_ADMIN, isActive: true, driverProfile: null }],
    ['an account linked to another driver', { id: 'u', role: UserRole.DRIVER, isActive: true, driverProfile: { id: 'driver-2' } }],
    ['a deactivated account', { id: 'u', role: UserRole.STUDENT, isActive: false, driverProfile: null }],
  ])('refuses to link %s', async (_label, existing) => {
    const { service, tx } = setup();
    tx.driver.findUnique.mockResolvedValue(baseDriver);
    tx.user.findUnique.mockResolvedValue(existing);

    await expect(service.linkAccount('driver-1', { email: 'x@y.com' }, 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.driver.update).not.toHaveBeenCalled();
  });

  it('refuses to replace an already linked account', async () => {
    const { service, tx } = setup();
    tx.driver.findUnique.mockResolvedValue({ ...baseDriver, userId: 'user-1' });
    tx.user.findUnique.mockResolvedValue(null);

    await expect(service.linkAccount('driver-1', { email: 'new@gmail.com' }, 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws when the driver does not exist', async () => {
    const { service, tx } = setup();
    tx.driver.findUnique.mockResolvedValue(null);
    await expect(service.linkAccount('missing', { email: 'a@b.com' }, 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unlinks: account back to STUDENT and every open session revoked', async () => {
    const { service, tx, audit } = setup();
    tx.driver.findUnique.mockResolvedValue({ ...baseDriver, userId: 'user-9', user: { email: 'luis@gmail.com' } });
    tx.driver.update.mockResolvedValue({ ...baseDriver, userId: null, user: null });

    const result = await service.unlinkAccount('driver-1', 'admin-1');

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'user-9' }, data: { role: UserRole.STUDENT } });
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-9', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.accountEmail).toBeNull();
    expect(audit.logAction).toHaveBeenCalledWith('admin-1', 'UNLINK_ACCOUNT', 'Driver', 'driver-1', {
      email: 'luis@gmail.com',
    });
  });

  it('refuses to unlink a driver without account', async () => {
    const { service, tx } = setup();
    tx.driver.findUnique.mockResolvedValue(baseDriver);
    await expect(service.unlinkAccount('driver-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
