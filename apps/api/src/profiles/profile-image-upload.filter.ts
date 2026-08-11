import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';

import { ProfileApiException } from './profile.errors';

@Catch(MulterError, PayloadTooLargeException)
export class ProfileImageUploadFilter implements ExceptionFilter {
  public catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const mapped = new ProfileApiException(
      exception instanceof PayloadTooLargeException ||
        (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE')
        ? 'PROFILE_IMAGE_TOO_LARGE'
        : 'PROFILE_IMAGE_INVALID',
    );
    const response = host.switchToHttp().getResponse<{
      status(status: number): { json(body: unknown): void };
    }>();
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }
}
