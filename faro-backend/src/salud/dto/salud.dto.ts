import { ApiProperty } from '@nestjs/swagger';

export class SaludDto {
  @ApiProperty({ example: 'ok' })
  estado!: 'ok';

  @ApiProperty({ example: 'ok' })
  baseDatos!: 'ok';
}
