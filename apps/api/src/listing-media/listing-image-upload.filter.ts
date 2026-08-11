import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';

import { MarketplaceApiException } from '../common/marketplace.errors';

@Catch(MulterError, PayloadTooLargeException)
export class ListingImageUploadFilter implements ExceptionFilter {
  public catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const mapped = new MarketplaceApiException(
      exception instanceof PayloadTooLargeException ||
        (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE')
        ? 'IMAGE_TOO_LARGE'
        : 'IMAGE_INVALID',
    );
    const response = host.switchToHttp().getResponse<{
      status(status: number): { json(body: unknown): void };
    }>();
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }
}
