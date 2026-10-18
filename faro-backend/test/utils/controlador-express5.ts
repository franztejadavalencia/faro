import { Controller, Get, Module, Query, Req } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { Publico } from '../../src/common/decorators/publico.decorator';

/** Filtro de ejemplo: la regla de CLAUDE.md para listas en la query. */
export class FiltroDePruebaDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsString({ each: true })
  estado?: string[];
}

/** Solo de prueba: fija el comportamiento de Express 5 que usará el resto de FARO. */
@Publico()
@Controller('prueba-express5')
export class ControladorExpress5 {
  @Get('query')
  query(@Req() req: Request): unknown {
    return req.query;
  }

  @Get('filtro')
  filtro(@Query() filtro: FiltroDePruebaDto): FiltroDePruebaDto {
    return filtro;
  }

  @Get('ip')
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }

  // Express 5 / path-to-regexp 8: el comodín lleva nombre.
  @Get('archivos/*splat')
  archivos(@Req() req: Request): unknown {
    return { splat: (req.params as Record<string, unknown>).splat };
  }
}

@Module({ controllers: [ControladorExpress5] })
export class ModuloExpress5 {}
