import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

const check = async (name: unknown) => {
  const dto = plainToInstance(UpdateMeDto, { name });
  return { dto, errors: await validate(dto) };
};

describe('UpdateMeDto', () => {
  it('trims and collapses whitespace', async () => {
    const { dto, errors } = await check('  Carlos   Morán ');
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Carlos Morán');
  });

  it('rejects too short, too long and non-string names', async () => {
    expect((await check(' a ')).errors).not.toHaveLength(0);
    expect((await check('x'.repeat(61))).errors).not.toHaveLength(0);
    expect((await check(42)).errors).not.toHaveLength(0);
  });
});
