import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const clean = (body: any) => {
  const out: any = {};
  for (const k of Object.keys(body || {})) {
    if (k === 'id' || k === 'createdAt') continue;
    if (body[k] !== null && typeof body[k] === 'object') continue;
    out[k] = body[k];
  }
  return out;
};

/** Fabrica un controlador CRUD (listar, crear, editar, eliminar) para una entidad simple */
export function makeCrud(route: string, entity: any, opts: { relations?: string[]; order?: any; hasDate?: boolean } = {}) {
  @Controller(route)
  @UseGuards(JwtAuthGuard)
  class CrudController {
    constructor(@InjectRepository(entity) readonly repo: Repository<any>) {}

    @Get() list(@Query('from') from?: string, @Query('to') to?: string) {
      const where: any = {};
      if (opts.hasDate && (from || to)) where.date = from && to ? Between(from, to) : from ? MoreThanOrEqual(from) : LessThanOrEqual(to);
      return this.repo.find({ where, relations: opts.relations, order: opts.order });
    }
    @Post() create(@Body() body: any) {
      return this.repo.save(this.repo.create(clean(body) as any));
    }
    @Put(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
      const e = await this.repo.findOne({ where: { id } });
      if (!e) throw new NotFoundException('Registro no encontrado');
      Object.assign(e, clean(body));
      return this.repo.save(e);
    }
    @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) {
      try {
        await this.repo.delete(id);
        return { ok: true };
      } catch {
        throw new ConflictException('No se puede eliminar: tiene registros asociados');
      }
    }
  }
  return CrudController;
}
