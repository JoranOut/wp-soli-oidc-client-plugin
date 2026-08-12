<?php
/**
 * Test Fixture: Forced Token Endpoint Failures
 *
 * Makes the token endpoint fail in a specific way, so the suite can assert what
 * the client reports. The provider is a real wp-env instance and will not return
 * a 429 or an HTML error page on request, so the failure is injected on the
 * client side.
 *
 * Injection happens on `http_response` at priority 5, NOT on `pre_http_request`.
 * `WP_Http::request()` returns a `pre_http_request` short-circuit immediately and
 * never applies `http_response`, so a fixture built on it would bypass the very
 * filter Token_Diagnostics registers and the tests would pass against nothing.
 * Rewriting the real response at priority 5 leaves the production path intact:
 * the request goes to the provider, the fixture corrupts the reply, and the
 * plugin's own filter at priority 10 sees exactly what a broken provider sends.
 *
 * Enable by setting the `soli_test_force_token_failure` option to a mode:
 *
 *   html-429   HTTP 429 with Laravel's HTML "Too Many Requests" page
 *   empty-200  HTTP 200 with an empty body
 *   json-429   HTTP 429 with a JSON body (the well-behaved provider case)
 *
 * Unset or empty means normal operation. Only the token endpoint is affected;
 * every other request passes through untouched.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter(
	'http_response',
	function ( $response, $parsed_args, $url ) {
		$mode = get_option( 'soli_test_force_token_failure', '' );

		if ( empty( $mode ) ) {
			return $response;
		}

		$settings = get_option( 'openid_connect_generic_settings', array() );

		if ( empty( $settings['endpoint_token'] ) ) {
			return $response;
		}

		if ( untrailingslashit( $url ) !== untrailingslashit( $settings['endpoint_token'] ) ) {
			return $response;
		}

		// One-shot. A mode left armed breaks every later login on the site,
		// including the suite's own teardown, which turns one failing assertion
		// into a whole file of failures that all point at the wrong thing.
		delete_option( 'soli_test_force_token_failure' );

		switch ( $mode ) {
			case 'html-429':
				// Padded to roughly the size of the real Laravel error page, so a
				// byte count in the diagnostics is exercised rather than assumed.
				$body = '<!DOCTYPE html><html><head><title>Too Many Requests</title></head>'
					. '<body><h1>429 Too Many Requests</h1><p>'
					. str_repeat( 'x', 6000 )
					. '</p></body></html>';

				return array(
					'headers'  => array( 'content-type' => 'text/html; charset=UTF-8' ),
					'body'     => $body,
					'response' => array(
						'code'    => 429,
						'message' => 'Too Many Requests',
					),
					'cookies'  => array(),
					'filename' => null,
				);

			case 'empty-200':
				return array(
					'headers'  => array(),
					'body'     => '',
					'response' => array(
						'code'    => 200,
						'message' => 'OK',
					),
					'cookies'  => array(),
					'filename' => null,
				);

			case 'json-429':
				return array(
					'headers'  => array( 'content-type' => 'application/json' ),
					'body'     => wp_json_encode(
						array(
							'message' => 'Too Many Attempts.',
						)
					),
					'response' => array(
						'code'    => 429,
						'message' => 'Too Many Requests',
					),
					'cookies'  => array(),
					'filename' => null,
				);
		}

		return $response;
	},
	5,
	3
);

/**
 * Let the E2E suite flip the mode without wp-cli.
 *
 * Restricted to logged-in administrators: the fixture can break every login on
 * the site, and the client environment is reachable on localhost.
 */
add_action(
	'wp_ajax_soli_test_force_token_failure',
	function (): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'forbidden' ), 403 );
		}

		$mode = isset( $_GET['mode'] ) ? sanitize_text_field( wp_unslash( $_GET['mode'] ) ) : '';

		$allowed = array( '', 'html-429', 'empty-200', 'json-429' );

		if ( ! in_array( $mode, $allowed, true ) ) {
			wp_send_json_error( array( 'message' => 'unknown mode' ), 400 );
		}

		update_option( 'soli_test_force_token_failure', $mode );

		wp_send_json_success( array( 'mode' => $mode ) );
	}
);
