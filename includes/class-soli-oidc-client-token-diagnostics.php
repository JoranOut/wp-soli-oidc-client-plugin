<?php

namespace Soli\OidcClient;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Token Diagnostics
 *
 * Makes a failed token exchange say why it failed.
 *
 * The OIDC client plugin sends the token request with only a `Host` header, so the
 * provider renders errors as HTML. It then reports any unparseable body as the
 * generic `invalid-token`, discarding the HTTP status. A provider rate limit, a
 * gateway error and a redirect to a login page all arrive as the same three words.
 *
 * This class does two things:
 *
 * 1. Asks for JSON, so Laravel returns a machine-readable body for its own errors
 *    (a 429 from `throttle` renders as HTML otherwise).
 * 2. Translates a non-JSON token response into the OAuth error shape the client
 *    already understands, so the real status reaches the login screen as
 *    `login-error=provider-http-429` instead of `login-error=invalid-token`.
 *
 * Diagnosed the hard way on 2026-08-10: dev.soli.nl was down for an afternoon
 * because a stale rate-limiter counter on the provider returned 429 HTML and this
 * client threw the status away.
 */
class Token_Diagnostics {

	/**
	 * Client operations that talk to the token endpoint.
	 */
	private const TOKEN_OPERATIONS = array( 'get-authentication-token', 'refresh-token' );

	/**
	 * Initialize the diagnostics hooks
	 */
	public function init(): void {
		add_filter( 'openid-connect-generic-alter-request', array( $this, 'accept_json' ), 10, 2 );
		add_filter( 'http_response', array( $this, 'translate_non_json_response' ), 10, 3 );
	}

	/**
	 * Ask the provider for JSON on token requests.
	 *
	 * Merges rather than replaces: the client sets a `Host` header for reverse-proxy
	 * setups and dropping it would break those.
	 *
	 * @param array  $request   The request array passed to wp_remote_post().
	 * @param string $operation The client operation performing the request.
	 *
	 * @return array
	 */
	public function accept_json( $request, $operation ) {
		if ( ! in_array( $operation, self::TOKEN_OPERATIONS, true ) ) {
			return $request;
		}

		if ( ! is_array( $request ) ) {
			return $request;
		}

		$headers = isset( $request['headers'] ) && is_array( $request['headers'] ) ? $request['headers'] : array();

		// Do not override an Accept header someone else set deliberately.
		if ( ! isset( $headers['Accept'] ) ) {
			$headers['Accept'] = 'application/json';
		}

		$request['headers'] = $headers;

		return $request;
	}

	/**
	 * Give a non-JSON token response an error the client can report.
	 *
	 * Runs on every outbound HTTP response, so it returns early for anything that is
	 * not the configured token endpoint.
	 *
	 * @param array  $response    The HTTP response array.
	 * @param array  $parsed_args The request arguments.
	 * @param string $url         The requested URL.
	 *
	 * @return array
	 */
	public function translate_non_json_response( $response, $parsed_args, $url ) {
		/**
		 * Filter whether a non-JSON token response is translated into an OAuth error.
		 *
		 * Disable to get the client's stock `invalid-token` behaviour back.
		 *
		 * @param bool $enabled Whether translation is enabled.
		 */
		if ( ! apply_filters( 'soli_oidc_client_translate_token_errors', true ) ) {
			return $response;
		}

		if ( is_wp_error( $response ) || ! is_array( $response ) ) {
			return $response;
		}

		if ( ! $this->is_token_endpoint( $url ) ) {
			return $response;
		}

		$body = wp_remote_retrieve_body( $response );

		// A parseable body needs no help - including a JSON error, which the client
		// already reports accurately.
		if ( '' !== $body && ! is_null( json_decode( $body, true ) ) ) {
			return $response;
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$message = wp_remote_retrieve_response_message( $response );

		$code        = $status > 0 ? 'provider-http-' . $status : 'provider-unreadable-response';
		$description = sprintf(
			/* translators: 1: HTTP status code, 2: HTTP status message, 3: response body size in bytes */
			__( 'The provider returned HTTP %1$d %2$s with a non-JSON body (%3$d bytes) instead of a token.', 'soli-oidc-client' ),
			$status,
			$message,
			strlen( $body )
		);

		$this->log( $url, $status, $body );

		$response['body'] = wp_json_encode(
			array(
				'error'             => $code,
				'error_description' => $description,
			)
		);

		return $response;
	}

	/**
	 * Whether a URL is the configured token endpoint.
	 *
	 * @param string $url The requested URL.
	 *
	 * @return bool
	 */
	private function is_token_endpoint( $url ): bool {
		if ( ! is_string( $url ) || '' === $url ) {
			return false;
		}

		$settings = get_option( 'openid_connect_generic_settings', array() );

		if ( ! is_array( $settings ) || empty( $settings['endpoint_token'] ) ) {
			return false;
		}

		return untrailingslashit( $url ) === untrailingslashit( $settings['endpoint_token'] );
	}

	/**
	 * Record the failure, with enough of the body to recognise the page.
	 *
	 * @param string $url    The token endpoint.
	 * @param int    $status The HTTP status code.
	 * @param string $body   The response body.
	 */
	private function log( string $url, int $status, string $body ): void {
		if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
			return;
		}

		error_log(
			sprintf(
				'[soli-oidc-client] Non-JSON token response from %s: HTTP %d, %d bytes. First 200 bytes: %s',
				$url,
				$status,
				strlen( $body ),
				str_replace( array( "\r", "\n" ), ' ', substr( $body, 0, 200 ) )
			)
		);
	}
}
