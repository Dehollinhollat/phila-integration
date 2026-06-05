// Mock Prisma client — remplace toutes les interactions DB par des jest.fn()
// Chaque méthode retourne une Promise résolue par défaut (configurable dans chaque test).
// Pattern : prisma.contact.findMany.mockResolvedValue([...]) dans beforeEach du test.
const prisma = {
  contact: {
    findUnique:  jest.fn(),
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    update:      jest.fn(),
    delete:      jest.fn(),
    count:       jest.fn(),
  },
  user: {
    findUnique:  jest.fn(),
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    update:      jest.fn(),
  },
  message: {
    findMany:    jest.fn(),
    create:      jest.fn(),
    createMany:  jest.fn(),
    update:      jest.fn(),
    count:       jest.fn(),
  },
  checklistItem: {
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    createMany:  jest.fn(),
    update:      jest.fn(),
  },
  settings: {
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    upsert:      jest.fn(),
  },
  notification: {
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    createMany:  jest.fn(),
    update:      jest.fn(),
    count:       jest.fn(),
  },
  historiqueStatut: {
    findMany:    jest.fn(),
    create:      jest.fn(),
    deleteMany:  jest.fn(),
  },
  commentaire: {
    findMany:    jest.fn(),
    create:      jest.fn(),
    deleteMany:  jest.fn(),
  },
  refreshToken: {
    create:      jest.fn(),
    findUnique:  jest.fn(),
    delete:      jest.fn(),
    deleteMany:  jest.fn(),
  },
  connectionLog: {
    create:      jest.fn(),
    findMany:    jest.fn(),
  },
  ouvrier: {
    findUnique:  jest.fn(),
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    update:      jest.fn(),
  },
  auditLog: {
    create:   jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(prisma as unknown)),
};

export default prisma;
