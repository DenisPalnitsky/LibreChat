import { Import } from 'lucide-react';
import { cn } from '~/utils';
import { useUploadConversationsMutation } from '~/data-provider';
import { useLocalize, useConversations } from '~/hooks';
import { useState, useEffect, useCallback } from 'react';
import { useToastContext } from '~/Providers';

function ImportConversations() {
  const localize = useLocalize();

  const { showToast } = useToastContext();
  const [errors, setErrors] = useState<string[]>([]);
  const setError = (error: string) => setErrors((prevErrors) => [...prevErrors, error]);
  const { refreshConversations } = useConversations();

  //const fileInputRef = useRef(null);
  //const uploadFile = useImportFileHandling();

  const setFilesLoading = (arg0: boolean) => {
    throw new Error('Function not implemented.');
  };

  const uploadFile = useUploadConversationsMutation({
    onSuccess: (data) => {
      console.log('upload success', data);
      showToast({ message: localize('com_ui_import_conversation_success') });
      refreshConversations();
    },
    onError: (error) => {
      console.error('Error: ', error);
      setError(
        (error as { response: { data: { message?: string } } })?.response?.data?.message ??
          'An error occurred while uploading the file.',
      );
      showToast({ message: localize('com_ui_import_conversation_error'), status: 'error' });
    },
  });

  const startUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file, encodeURIComponent(file?.name || 'File'));

    uploadFile.mutate(formData);
  };

  const validateFiles = (file: File) => {
    console.debug('Validating files...');
    return true;
  };

  const handleFiles = async (_file: File) => {
    console.log('Handling files...');
    /* Validate file */
    let filesAreValid: boolean;
    try {
      filesAreValid = validateFiles(_file);
    } catch (error) {
      console.error('file validation error', error);
      setError('An error occurred while validating the file.');
      return;
    }
    if (!filesAreValid) {
      setFilesLoading(false);
      return;
    }

    /* Process files */
    try {
      await startUpload(_file);
    } catch (error) {
      console.log('file handling error', error);
      setError('An error occurred while processing the file.');
    }
  };

  const handleFileChange = (event) => {
    console.log('file change');
    const file = event.target.files[0];
    if (file) {
      // const formData = new FormData();
      // formData.append('file', file);

      console.log('call handleFiles');
      handleFiles(file);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span>{localize('com_ui_import_conversation_info')}</span>
        <label
          htmlFor={'import-conversations-file'}
          className="flex h-auto cursor-pointer items-center rounded bg-transparent px-2 py-1 text-xs font-medium font-normal transition-colors hover:bg-gray-100 hover:text-green-700 dark:bg-transparent dark:text-white dark:hover:bg-gray-600 dark:hover:text-green-500"
        >
          <Import className="mr-1 flex w-[22px] items-center stroke-1" />
          <span>{localize('com_ui_import_conversation')}</span>
          <input
            id={'import-conversations-file'}
            value=""
            type="file"
            className={cn('hidden')}
            accept=".json"
            onChange={handleFileChange}
          />
        </label>
      </div>
    </>
  );
}

export default ImportConversations;
