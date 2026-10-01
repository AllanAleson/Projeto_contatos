export interface Contato {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  fotoId?: string | null;
}
export type DadosContato = Omit<Contato, "_id">;
