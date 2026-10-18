import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validarEntorno } from '../config/env.validation';
import { opcionesTypeOrm } from './typeorm.config';

// Fuera de Nest no hay ConfigModule: la CLI de TypeORM carga el mismo `.env`.
config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

const variables = validarEntorno(process.env);

export default new DataSource({
  ...opcionesTypeOrm(variables),
  entities: ['src/**/*.entity.ts'],
});
