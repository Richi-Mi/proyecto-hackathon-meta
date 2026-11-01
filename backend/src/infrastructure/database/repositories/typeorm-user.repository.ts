import type { DataSource, Repository } from 'typeorm'
import type { NewUser, UserRepository } from '../../../application/ports/user-repository'
import { ConflictError } from '../../../domain/errors'
import type { User } from '../../../domain/models/user'
import { UserEntity } from '../entities'
import { uniqueViolationColumn } from '../pg-errors'

export class TypeOrmUserRepository implements UserRepository {
  private readonly repo: Repository<UserEntity>

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(UserEntity)
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id })
  }

  findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne()
  }

  async create(data: NewUser): Promise<User> {
    try {
      const { passwordHash: _, ...user } = await this.repo.save(this.repo.create(data))
      return user
    } catch (error) {
      if (uniqueViolationColumn(error) === 'email') {
        throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Ese email ya está registrado')
      }
      throw error
    }
  }
}
