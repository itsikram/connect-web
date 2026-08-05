import { FaFacebook, FaLinkedin, FaGithub } from 'react-icons/fa';

export default function SocialIcons() {
  return (
    <div className="flex space-x-4" aria-label="Social links">
      <a
        href="https://facebook.com/programmerikram"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook"
      >
        <FaFacebook size={22} />
      </a>
      <a
        href="https://www.linkedin.com/in/ikramul-islam-38a484260/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <FaLinkedin size={22} />
      </a>
      <a
        href="https://github.com/itsikram"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <FaGithub size={22} />
      </a>
    </div>
  );
}
