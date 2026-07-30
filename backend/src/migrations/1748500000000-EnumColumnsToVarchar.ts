import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #89 — Padronizar a representação dos enums em todo o schema: converter as
 * colunas de tipo enum nativo (Postgres) para `varchar(30)` + `CHECK`.
 *
 * Decisão (Opção B): os enums do domínio evoluem com frequência; `varchar+CHECK`
 * evolui com um simples DROP/ADD CONSTRAINT, ao contrário do `ALTER TYPE` rígido
 * dos enums nativos. A validação dos valores está garantida na app
 * (enums TypeScript + class-validator nos DTOs); o CHECK reforça na BD.
 *
 * `up`:
 *   1. Para cada tipo enum nativo conhecido, converte as colunas que o usam para
 *      `varchar(30)` (dropando o default antes do cast) e dropa o tipo.
 *   2. Reaplica defaults + adiciona CHECKs (espelho do init.sql), por tabela e
 *      guardado por `to_regclass` (ignora tabelas ausentes no ambiente).
 *
 * `down`: irreversível na prática (os tipos nativos teriam de ser recriados com a
 *   ordem exacta de valores). Mantido como no-op documentado — a coluna fica
 *   `varchar`, que é o estado-alvo do schema.
 */
export class EnumColumnsToVarchar1748500000000 implements MigrationInterface {
  name = 'EnumColumnsToVarchar1748500000000';

  private readonly enumTypes = [
    'clientes_tipo_enum',
    'comissoes_tipo_enum',
    'encomendas_estado_enum',
    'equip_instalados_estado_enum',
    'equipamentos_tipo_enum',
    'faturas_estado_enum',
    'maquina_historico_estado_enum',
    'maquina_historico_tipo_enum',
    'maquinas_instaladas_estado_enum',
    'modelos_equipamento_tipo_enum',
    'movimentos_stock_tipo_enum',
    'ordens_servico_estado_enum',
    'ordens_servico_tipo_enum',
    'ordens_trabalho_estado_enum',
    'ordens_trabalho_natureza_intervencao_enum',
    'ordens_trabalho_prioridade_enum',
    'ordens_trabalho_tipo_enum',
    'sys_logs_tipo_enum',
    'users_role_enum',
  ];

  /** (tabela, coluna, default|null, valores do CHECK, nullable) */
  private readonly columns: Array<{
    table: string; column: string; def: string | null; values: string[]; nullable?: boolean;
  }> = [
    { table: 'ordens_trabalho', column: 'tipo', def: 'pontual', values: ['pontual', 'periodica'] },
    { table: 'ordens_trabalho', column: 'natureza_intervencao', def: null, nullable: true,
      values: ['Manutenção', 'Substituição de filtro', 'Reparação de avaria', 'Inspeção', 'Montagem / Instalação'] },
    { table: 'ordens_trabalho', column: 'prioridade', def: 'Normal', values: ['Normal', 'Alta', 'Urgente'] },
    { table: 'ordens_trabalho', column: 'estado', def: 'Registada',
      values: ['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada'] },
    { table: 'clientes', column: 'tipo', def: 'empresa', values: ['empresa', 'particular'] },
    { table: 'users', column: 'role', def: 'campo', values: ['admin', 'suporte', 'coordenador', 'campo', 'vendedor'] },
    { table: 'encomendas', column: 'estado', def: 'Aberta',
      values: ['Aberta', 'Aprovada', 'Parcial', 'Recebida', 'Cancelada', 'Faturada'] },
    { table: 'faturas', column: 'estado', def: 'Pendente', values: ['Pendente', 'Paga', 'Anulada', 'Emitido'] },
    { table: 'comissoes', column: 'tipo', def: null, values: ['tecnico', 'vendedor'] },
    { table: 'sys_logs', column: 'tipo', def: 'info', values: ['info', 'warning', 'error'] },
    { table: 'equip_instalados', column: 'estado', def: 'ativo', values: ['ativo', 'com_problema', 'inativo'] },
    { table: 'modelos_equipamento', column: 'tipo', def: 'maquina', values: ['maquina', 'filtro'] },
    { table: 'movimentos_stock', column: 'tipo', def: null,
      values: ['entrada', 'saida', 'ajuste', 'transferencia', 'devolucao'] },
    { table: 'faturas', column: 'estado', def: 'pendente', values: ['pendente', 'paga'] },
    { table: 'equipamentos', column: 'tipo', def: null, values: ['maquina', 'filtro', 'peca', 'filtro_maquina'] },
    { table: 'maquinas_instaladas', column: 'estado', def: 'ativa', values: ['ativa', 'com_problema', 'desativada'] },
    { table: 'maquina_historico', column: 'tipo', def: null, values: ['montagem', 'preventiva', 'corretiva', 'remota'] },
    { table: 'maquina_historico', column: 'estado', def: 'concluida', values: ['concluida', 'cancelada'] },
    { table: 'ordens_servico', column: 'tipo', def: null, values: ['montagem', 'preventiva', 'corretiva', 'remota'] },
    { table: 'ordens_servico', column: 'estado', def: 'aberta',
      values: ['aberta', 'em_execucao', 'concluida', 'cancelada', 'resolvida_remotamente'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Converter colunas que usem um tipo enum nativo → varchar(30).
    //    Loop genérico: só processa colunas que de facto existem e usam o tipo.
    for (const typeName of this.enumTypes) {
      const cols: Array<{ table_name: string; column_name: string }> = await queryRunner.query(
        `SELECT c.table_name, c.column_name
           FROM information_schema.columns c
          WHERE c.udt_name = $1 AND c.table_schema = current_schema()`,
        [typeName],
      );
      for (const { table_name, column_name } of cols) {
        await queryRunner.query(`ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" DROP DEFAULT;`);
        await queryRunner.query(
          `ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" TYPE varchar(30) USING "${column_name}"::text;`,
        );
      }
      await queryRunner.query(`DROP TYPE IF EXISTS "${typeName}";`);
    }

    // 2. Reaplicar defaults + adicionar CHECKs (espelho do init.sql), por coluna.
    for (const c of this.columns) {
      const reg: Array<{ exists: string | null }> = await queryRunner.query(
        `SELECT to_regclass($1) AS exists`, [c.table],
      );
      if (!reg[0]?.exists) continue; // tabela não existe neste ambiente

      if (c.def !== null) {
        await queryRunner.query(
          `ALTER TABLE "${c.table}" ALTER COLUMN "${c.column}" SET DEFAULT '${c.def.replace(/'/g, "''")}';`,
        );
      }
      const list = c.values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      const guard = c.nullable ? `"${c.column}" IS NULL OR ` : '';
      const cname = `chk_${c.table}_${c.column}`.slice(0, 63);
      await queryRunner.query(`ALTER TABLE "${c.table}" DROP CONSTRAINT IF EXISTS "${cname}";`);
      await queryRunner.query(
        `ALTER TABLE "${c.table}" ADD CONSTRAINT "${cname}" CHECK (${guard}"${c.column}" IN (${list}));`,
      );
    }
  }

  public async down(): Promise<void> {
    // Irreversível na prática: recriar os tipos enum nativos exigiria a ordem
    // exacta de valores e converter de volta cada coluna. O estado-alvo do
    // schema é varchar — não há reversão automática. No-op documentado.
  }
}
